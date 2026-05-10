import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', durationMs = 4000): void {
    const id = crypto.randomUUID();
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: string): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
