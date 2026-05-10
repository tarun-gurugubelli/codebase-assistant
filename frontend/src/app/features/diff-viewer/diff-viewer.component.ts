import { Component, Input, ChangeDetectionStrategy, signal } from '@angular/core';

interface DiffEntry {
  filePath: string;
  diff: string;
  summary: string;
}

@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (diffs.length === 0) {
      <div class="flex flex-col items-center justify-center h-full text-center text-gray-600 p-4 space-y-2">
        <svg class="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <p class="text-xs">Suggested diffs will appear here when the agent uses <code class="font-mono text-gray-500">write_suggestion</code>.</p>
      </div>
    } @else {
      <div class="divide-y divide-gray-800">
        @for (entry of diffs; track entry.filePath) {
          <div class="p-3 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs font-mono text-brand-400 truncate">{{ entry.filePath }}</p>
                @if (entry.summary) {
                  <p class="text-xs text-gray-400 mt-0.5">{{ entry.summary }}</p>
                }
              </div>
              <button
                class="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                (click)="copyDiff(entry.diff)"
              >{{ copied() === entry.filePath ? '✓' : 'Copy' }}</button>
            </div>
            <pre class="text-xs font-mono overflow-x-auto rounded bg-code-bg border border-code-border p-3 leading-relaxed"><code [innerHTML]="highlight(entry.diff)"></code></pre>
          </div>
        }
      </div>
    }
  `,
})
export class DiffViewerComponent {
  @Input() diffs: DiffEntry[] = [];
  copied = signal<string | null>(null);

  highlight(diff: string): string {
    return diff
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return `<span class="text-green-400">${this.escape(line)}</span>`;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
          return `<span class="text-red-400">${this.escape(line)}</span>`;
        }
        if (line.startsWith('@@')) {
          return `<span class="text-brand-400">${this.escape(line)}</span>`;
        }
        return `<span class="text-gray-400">${this.escape(line)}</span>`;
      })
      .join('\n');
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  copyDiff(diff: string): void {
    navigator.clipboard.writeText(diff);
    this.copied.set(diff);
    setTimeout(() => this.copied.set(null), 2000);
  }
}
