import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Message, SSEEvent } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private api = inject(ApiService);

  readonly messages = signal<Message[]>([]);
  readonly isStreaming = signal(false);
  private activeStream: EventSource | null = null;

  loadHistory(sessionId: string): Observable<{ messages: Message[] }> {
    return this.api.get<{ messages: Message[] }>(`/chat/${sessionId}/history`).pipe(
      tap(res => this.messages.set(res.messages ?? []))
    );
  }

  clearHistory(sessionId: string): Observable<void> {
    return this.api.delete<void>(`/chat/${sessionId}/history`).pipe(
      tap(() => this.messages.set([]))
    );
  }

  clearLocal(): void {
    this.messages.set([]);
  }

  cancelStream(): void {
    if (!this.activeStream) return;
    this.activeStream.close();
    this.activeStream = null;
    this.isStreaming.set(false);
    // Mark the last (incomplete) assistant message as cancelled
    this.messages.update(msgs => {
      if (msgs.length === 0) return msgs;
      const last = msgs[msgs.length - 1];
      if (last.role !== 'assistant') return msgs;
      return msgs.with(msgs.length - 1, {
        ...last,
        content: last.content + (last.content ? '\n\n*[cancelled]*' : '*[cancelled]*'),
      });
    });
  }

  sendMessage(
    sessionId: string,
    text: string,
    onEvent: (evt: SSEEvent) => void
  ): void {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.messages.update(msgs => [...msgs, userMsg]);

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      citations: [],
      createdAt: new Date().toISOString(),
    };
    this.messages.update(msgs => [...msgs, assistantMsg]);
    this.isStreaming.set(true);

    this.api
      .post<{ streamId: string }>(`/chat/${sessionId}/message`, { message: text })
      .subscribe({
        next: ({ streamId }) => {
          const url = this.api.streamUrl(`/chat/${sessionId}/stream/${streamId}`);
          const es = new EventSource(url);
          this.activeStream = es;

          es.onmessage = event => {
            if (event.data === '[DONE]') {
              es.close();
              this.activeStream = null;
              this.isStreaming.set(false);
              return;
            }
            try {
              const evt: SSEEvent = JSON.parse(event.data);
              onEvent(evt);

              if (evt.type === 'token' && evt.content) {
                this.messages.update(msgs => {
                  const last = msgs[msgs.length - 1];
                  return msgs.with(msgs.length - 1, {
                    ...last,
                    content: last.content + evt.content,
                  });
                });
              } else if (evt.type === 'citation' && evt.filePath) {
                this.messages.update(msgs => {
                  const last = msgs[msgs.length - 1];
                  const citations = [...(last.citations ?? []), {
                    filePath: evt.filePath!,
                    startLine: evt.startLine ?? 0,
                    endLine: evt.endLine ?? 0,
                    score: evt.score,
                  }];
                  return msgs.with(msgs.length - 1, { ...last, citations });
                });
              } else if (evt.type === 'done') {
                this.isStreaming.set(false);
              } else if (evt.type === 'error') {
                this.isStreaming.set(false);
                es.close();
              }
            } catch {
              // ignore parse errors
            }
          };

          es.onerror = () => {
            es.close();
            this.activeStream = null;
            this.isStreaming.set(false);
          };
        },
        error: () => this.isStreaming.set(false),
      });
  }
}
