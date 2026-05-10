import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { FileTreeNode } from '../../core/models/session.model';
import { FileTreeNodeComponent } from './file-tree-node.component';

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [FileTreeNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nodes.length === 0) {
      <p class="text-xs text-gray-600 px-4 py-3">No files available.</p>
    } @else {
      <div class="px-2 py-2 text-xs">
        @for (node of nodes; track node.path) {
          <app-file-tree-node
            [node]="node"
            [highlightedPaths]="highlightedPaths"
            [depth]="0"
          />
        }
      </div>
    }
  `,
})
export class FileTreeComponent {
  @Input() nodes: FileTreeNode[] = [];
  @Input() highlightedPaths: string[] = [];
}
