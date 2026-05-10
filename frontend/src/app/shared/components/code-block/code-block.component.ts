import { Component, Input, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative group rounded-lg overflow-hidden border border-code-border">
      @if (label) {
        <div class="flex items-center justify-between px-3 py-1.5 bg-code-surface text-xs text-gray-400 font-mono border-b border-code-border">
          <span>{{ label }}</span>
          <button
            class="opacity-0 group-hover:opacity-100 transition-opacity hover:text-gray-200"
            (click)="copy()"
          >{{ copied() ? '✓ Copied' : 'Copy' }}</button>
        </div>
      }
      <pre class="bg-code-bg text-gray-200 text-sm font-mono p-4 overflow-x-auto leading-relaxed"><code>{{ code }}</code></pre>
      @if (!label) {
        <button
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-gray-200 bg-code-surface px-2 py-1 rounded"
          (click)="copy()"
        >{{ copied() ? '✓' : 'Copy' }}</button>
      }
    </div>
  `,
})
export class CodeBlockComponent {
  @Input() code = '';
  @Input() label = '';
  copied = signal(false);

  copy(): void {
    navigator.clipboard.writeText(this.code).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
