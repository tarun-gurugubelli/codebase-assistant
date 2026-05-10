import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Citation } from '../../../core/models/message.model';

@Component({
  selector: 'app-citations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (citations.length > 0) {
      <div class="mt-3">
        <!-- Toggle header -->
        <button
          class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors group"
          (click)="expanded = !expanded"
        >
          <svg
            class="w-3 h-3 shrink-0 transition-transform duration-200"
            [class.rotate-90]="expanded"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="font-medium uppercase tracking-wider">Sources</span>
          <span class="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">{{ citations.length }}</span>
        </button>

        <!-- Collapsible list -->
        @if (expanded) {
          <div class="flex flex-wrap gap-1.5 mt-2">
            @for (c of citations; track c.filePath + c.startLine) {
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-code-surface border border-code-border text-gray-300"
                [title]="tooltip(c)"
              >
                <svg class="w-3 h-3 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {{ shortPath(c.filePath) }}:{{ c.startLine }}–{{ c.endLine }}
                @if (c.score != null) {
                  <span class="text-gray-500">({{ (c.score * 100).toFixed(0) }}%)</span>
                }
              </span>
            }
          </div>
        }
      </div>
    }
  `,
})
export class CitationsComponent {
  @Input() citations: Citation[] = [];
  expanded = false;

  shortPath(path: string): string {
    const parts = path.split('/');
    return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : path;
  }

  tooltip(c: Citation): string {
    return `${c.filePath} lines ${c.startLine}–${c.endLine}`;
  }
}
