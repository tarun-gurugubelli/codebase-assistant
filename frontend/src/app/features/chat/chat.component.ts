import {
  Component,
  inject,
  signal,
  Input,
  OnInit,
  AfterViewChecked,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/services/chat.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { MessageComponent } from './message/message.component';
import { FileTreeComponent } from '../file-tree/file-tree.component';
import { DiffViewerComponent } from '../diff-viewer/diff-viewer.component';
import { SSEEvent } from '../../core/models/message.model';
import { FileTreeNode } from '../../core/models/session.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, SpinnerComponent, MessageComponent, FileTreeComponent, DiffViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-1 overflow-hidden">
      <!-- Chat panel -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <!-- Thinking indicator -->
        @if (thinkingStep()) {
          <div class="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-400 flex items-center gap-2">
            <app-spinner size="sm" class="text-brand-400" />
            <span>{{ thinkingStep() }}</span>
          </div>
        }

        <!-- Messages -->
        <div #messageContainer class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          @if (chatService.messages().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-2">
              <svg class="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4z" />
              </svg>
              <p class="text-sm">Ask anything about the codebase.</p>
              <p class="text-xs text-gray-600">e.g. "Where is authentication handled?" or "Find memory leaks"</p>
            </div>
          }
          @for (message of chatService.messages(); track message.id) {
            <app-message [message]="message" />
          }
        </div>

        <!-- Input bar -->
        <div class="border-t border-gray-800 px-4 py-3 bg-gray-950">
          <div class="flex items-end gap-2">
            <textarea
              class="input-field resize-none min-h-[42px] max-h-36"
              rows="1"
              placeholder="Ask about the codebase…"
              [(ngModel)]="inputText"
              [disabled]="chatService.isStreaming()"
              (keydown)="onKeydown($event)"
              (input)="autoResize($event)"
            ></textarea>
            <button
              class="btn-primary shrink-0 h-[42px] w-[42px] flex items-center justify-center"
              [disabled]="!inputText.trim() || chatService.isStreaming()"
              (click)="send()"
            >
              @if (chatService.isStreaming()) {
                <app-spinner size="sm" />
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            </button>
          </div>
          <div class="flex items-center justify-between mt-1.5">
            <p class="text-xs text-gray-600">Enter to send · Shift+Enter for newline</p>
            <button class="text-xs text-gray-600 hover:text-gray-400 transition-colors" (click)="clearHistory()">Clear history</button>
          </div>
        </div>
      </div>

      <!-- Right panel: file tree + diff viewer -->
      <div class="w-72 border-l border-gray-800 flex flex-col overflow-hidden bg-gray-950">
        <!-- Tab switcher -->
        <div class="flex border-b border-gray-800 text-xs">
          <button
            class="flex-1 py-2.5 font-medium transition-colors"
            [class.text-white]="rightPanel() === 'files'"
            [class.text-gray-500]="rightPanel() !== 'files'"
            [class.border-b-2]="rightPanel() === 'files'"
            [class.border-brand-500]="rightPanel() === 'files'"
            (click)="rightPanel.set('files')"
          >Files</button>
          <button
            class="flex-1 py-2.5 font-medium transition-colors"
            [class.text-white]="rightPanel() === 'diff'"
            [class.text-gray-500]="rightPanel() !== 'diff'"
            [class.border-b-2]="rightPanel() === 'diff'"
            [class.border-brand-500]="rightPanel() === 'diff'"
            (click)="rightPanel.set('diff')"
          >Diffs {{ activeDiffs().length ? '(' + activeDiffs().length + ')' : '' }}</button>
        </div>

        @if (rightPanel() === 'files') {
          <app-file-tree
            [nodes]="fileTree()"
            [highlightedPaths]="highlightedPaths()"
            class="flex-1 overflow-y-auto"
          />
        } @else {
          <app-diff-viewer [diffs]="activeDiffs()" class="flex-1 overflow-y-auto" />
        }
      </div>
    </div>
  `,
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @Input() id!: string;
  @ViewChild('messageContainer') messageContainer!: ElementRef<HTMLElement>;

  chatService = inject(ChatService);
  private sessionService = inject(SessionService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  inputText = '';
  thinkingStep = signal<string | null>(null);
  rightPanel = signal<'files' | 'diff'>('files');
  highlightedPaths = signal<string[]>([]);
  activeDiffs = signal<Array<{ filePath: string; diff: string; summary: string }>>([]);
  fileTree = signal<FileTreeNode[]>([]);

  private shouldScroll = false;

  ngOnInit(): void {
    this.chatService.clearLocal();
    this.sessionService.setActive(this.id);

    this.sessionService.getOne(this.id).subscribe(session => {
      this.fileTree.set(session.fileTree ?? []);
      this.cdr.markForCheck();
    });

    this.chatService.loadHistory(this.id).subscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.chatService.isStreaming()) return;
    this.inputText = '';
    this.activeDiffs.set([]);
    this.highlightedPaths.set([]);
    this.shouldScroll = true;

    this.chatService.sendMessage(this.id, text, (evt: SSEEvent) => {
      this.handleSSEEvent(evt);
      this.cdr.markForCheck();
      this.shouldScroll = true;
    });
  }

  private handleSSEEvent(evt: SSEEvent): void {
    if (evt.type === 'thinking') {
      const tool = evt.tool ?? '';
      const detail = evt.query ?? evt.filePath ?? '';
      this.thinkingStep.set(`${tool}${detail ? `: ${detail}` : ''}`);
    } else if (evt.type === 'citation' && evt.filePath) {
      this.highlightedPaths.update(paths =>
        paths.includes(evt.filePath!) ? paths : [...paths, evt.filePath!]
      );
    } else if (evt.type === 'suggestion' && evt.filePath && evt.diff) {
      this.activeDiffs.update(diffs => [
        ...diffs,
        { filePath: evt.filePath!, diff: evt.diff!, summary: evt.summary ?? '' },
      ]);
      this.rightPanel.set('diff');
    } else if (evt.type === 'done') {
      this.thinkingStep.set(null);
    } else if (evt.type === 'error') {
      this.thinkingStep.set(null);
      this.toast.show(evt.error ?? 'Agent error', 'error');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  clearHistory(): void {
    this.chatService.clearHistory(this.id).subscribe({
      next: () => this.toast.show('History cleared', 'success'),
      error: () => this.toast.show('Failed to clear history', 'error'),
    });
  }

  private scrollToBottom(): void {
    const el = this.messageContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
