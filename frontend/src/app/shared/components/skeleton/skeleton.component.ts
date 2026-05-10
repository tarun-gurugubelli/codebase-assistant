import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="animate-pulse bg-gray-800 rounded"
      [class]="extraClass"
      [style.height]="height"
      [style.width]="width"
    ></div>
  `,
})
export class SkeletonComponent {
  @Input() height = '1rem';
  @Input() width = '100%';
  @Input() extraClass = '';
}
