import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
  forwardRef,
} from '@angular/core';
import { FileTreeNode } from '../../core/models/session.model';

@Component({
  selector: 'app-file-tree-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // forwardRef lets the template reference itself before the class is fully defined
  imports: [forwardRef(() => FileTreeNodeComponent)],
  template: `
    <div>
      <button
        class="flex items-center gap-1.5 w-full text-left rounded px-1 py-0.5 transition-colors"
        [class.text-brand-400]="isHighlighted()"
        [class.bg-brand-900]="isHighlighted()"
        [class.text-gray-400]="!isHighlighted() && node.type === 'file'"
        [class.text-gray-300]="node.type === 'directory'"
        [class.hover:bg-gray-800]="!isHighlighted()"
        [style.paddingLeft.px]="depth * 12 + 4"
        (click)="toggle()"
      >
        @if (node.type === 'directory') {
          <svg class="w-3.5 h-3.5 shrink-0 transition-transform" [class.rotate-90]="expanded()" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
          <svg class="w-3.5 h-3.5 shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        } @else {
          <svg class="w-3.5 h-3.5 shrink-0 ml-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        <span class="font-mono truncate">{{ node.name }}</span>
        @if (isHighlighted()) {
          <span class="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"></span>
        }
      </button>

      @if (node.type === 'directory' && expanded() && node.children?.length) {
        @for (child of node.children; track child.path) {
          <app-file-tree-node
            [node]="child"
            [highlightedPaths]="highlightedPaths"
            [depth]="depth + 1"
          />
        }
      }
    </div>
  `,
})
export class FileTreeNodeComponent {
  @Input({ required: true }) node!: FileTreeNode;
  @Input() highlightedPaths: string[] = [];
  @Input() depth = 0;

  expanded = signal(false);

  toggle(): void {
    if (this.node.type === 'directory') this.expanded.update(v => !v);
  }

  isHighlighted(): boolean {
    return this.highlightedPaths.includes(this.node.path);
  }
}
