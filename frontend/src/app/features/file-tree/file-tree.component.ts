import {
  Component,
  Input,
  OnChanges,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FileTreeNode } from '../../core/models/session.model';

interface FlatNode {
  node: FileTreeNode;
  depth: number;
  expanded: boolean;
}

function flatten(nodes: FileTreeNode[], depth: number, expanded: Set<string>): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const isExpanded = expanded.has(node.path);
    result.push({ node, depth, expanded: isExpanded });
    if (node.type === 'directory' && isExpanded && node.children?.length) {
      result.push(...flatten(node.children, depth + 1, expanded));
    }
  }
  return result;
}

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    cdk-virtual-scroll-viewport { height: 100%; }
  `],
  template: `
    @if (nodes.length === 0) {
      <p class="text-xs text-gray-600 px-4 py-3">No files available.</p>
    } @else {
      <div class="flex-1 min-h-0 overflow-hidden" style="height: calc(100vh - 12rem)">
        <cdk-virtual-scroll-viewport itemSize="24" class="h-full w-full">
          <div class="px-2 py-2 text-xs">
            <ng-container *cdkVirtualFor="let item of flatNodes(); trackBy: trackByPath">
              <button
                class="flex items-center gap-1.5 w-full text-left rounded px-1 py-0.5 transition-colors"
                [class.text-brand-400]="isHighlighted(item.node.path)"
                [class.bg-brand-900]="isHighlighted(item.node.path)"
                [class.text-gray-400]="!isHighlighted(item.node.path) && item.node.type === 'file'"
                [class.text-gray-300]="item.node.type === 'directory'"
                [class.hover:bg-gray-800]="!isHighlighted(item.node.path)"
                [style.paddingLeft.px]="item.depth * 12 + 4"
                (click)="toggle(item)"
              >
                @if (item.node.type === 'directory') {
                  <svg class="w-3.5 h-3.5 shrink-0 transition-transform" [class.rotate-90]="item.expanded" fill="currentColor" viewBox="0 0 20 20">
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
                <span class="font-mono truncate">{{ item.node.name }}</span>
                @if (isHighlighted(item.node.path)) {
                  <span class="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"></span>
                }
              </button>
            </ng-container>
          </div>
        </cdk-virtual-scroll-viewport>
      </div>
    }
  `,
})
export class FileTreeComponent implements OnChanges {
  @Input() nodes: FileTreeNode[] = [];
  @Input() highlightedPaths: string[] = [];

  private expandedPaths = signal<Set<string>>(new Set());

  flatNodes = computed(() => flatten(this.nodes, 0, this.expandedPaths()));

  ngOnChanges(): void {
    // Reset expansion when tree changes (new session loaded)
    this.expandedPaths.set(new Set());
  }

  toggle(item: FlatNode): void {
    if (item.node.type !== 'directory') return;
    this.expandedPaths.update(set => {
      const next = new Set(set);
      if (next.has(item.node.path)) {
        next.delete(item.node.path);
      } else {
        next.add(item.node.path);
      }
      return next;
    });
  }

  isHighlighted(path: string): boolean {
    return this.highlightedPaths.includes(path);
  }

  trackByPath(_: number, item: FlatNode): string {
    return item.node.path;
  }
}
