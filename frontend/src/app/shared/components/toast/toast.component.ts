import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm animate-slide-in"
          [class]="toastClass(toast.type)"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button
            class="opacity-70 hover:opacity-100 transition-opacity"
            (click)="toastService.dismiss(toast.id)"
          >✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in { animation: slide-in 0.2s ease-out; }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);

  toastClass(type: string): string {
    return {
      success: 'bg-green-800 border border-green-600 text-green-100',
      error: 'bg-red-900 border border-red-700 text-red-100',
      info: 'bg-gray-800 border border-gray-700 text-gray-100',
    }[type] ?? 'bg-gray-800 text-gray-100';
  }
}
