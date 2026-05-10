import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Message } from '../../../core/models/message.model';
import { CitationsComponent } from '../citations/citations.component';
import { CodeBlockComponent } from '../../../shared/components/code-block/code-block.component';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CitationsComponent, CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-3" [class.flex-row-reverse]="message.role === 'user'">
      <!-- Avatar -->
      <div
        class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        [class.bg-brand-600]="message.role === 'assistant'"
        [class.bg-gray-700]="message.role === 'user'"
      >
        {{ message.role === 'assistant' ? 'AI' : 'U' }}
      </div>

      <div class="flex-1 min-w-0 space-y-2" [class.items-end]="message.role === 'user'" [class.flex]="message.role === 'user'" [class.flex-col]="message.role === 'user'">
        <!-- Bubble -->
        <div
          class="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed max-w-prose"
          [class.bg-gray-800]="message.role === 'assistant'"
          [class.bg-brand-700]="message.role === 'user'"
          [class.text-white]="true"
        >
          @for (part of parsedContent(); track $index) {
            @if (part.type === 'text') {
              <span class="whitespace-pre-wrap">{{ part.content }}</span>
            } @else {
              <app-code-block [code]="part.content" [label]="part.lang ?? ''" class="my-2 block" />
            }
          }
          @if (!message.content && message.role === 'assistant') {
            <span class="inline-block w-2 h-4 bg-brand-400 animate-pulse rounded-sm"></span>
          }
        </div>

        <!-- Citations -->
        @if (message.role === 'assistant' && message.citations?.length) {
          <app-citations [citations]="message.citations!" />
        }
      </div>
    </div>
  `,
})
export class MessageComponent {
  @Input({ required: true }) message!: Message;

  parsedContent(): Array<{ type: 'text' | 'code'; content: string; lang?: string }> {
    const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
    const regex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    const text = this.message.content;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', content: text.slice(lastIdx, match.index) });
      }
      parts.push({ type: 'code', content: match[2].trimEnd(), lang: match[1] || undefined });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIdx) });
    }
    return parts.length ? parts : [{ type: 'text', content: text }];
  }
}
