import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { signal } from '@angular/core';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="w-56 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden">
      <div class="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</div>

      <nav class="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        @if (loading()) {
          <div class="flex justify-center py-4">
            <app-spinner size="sm" class="text-gray-500" />
          </div>
        } @else if (sessionService.sessions().length === 0) {
          <p class="text-xs text-gray-600 px-2 py-2">No sessions yet. Ingest a repo to get started.</p>
        } @else {
          @for (session of sessionService.sessions(); track session.id) {
            <div
              class="group relative flex items-center rounded-lg px-2 py-2 cursor-pointer transition-colors"
              [class.bg-gray-800]="session.id === sessionService.activeSessionId()"
              [class.hover:bg-gray-800]="session.id !== sessionService.activeSessionId()"
              (click)="navigate(session)"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-200 truncate">{{ session.repoName }}</p>
                <p class="text-xs text-gray-500 truncate">
                  {{ statusLabel(session) }}
                </p>
              </div>
              <button
                class="opacity-0 group-hover:opacity-100 ml-1 p-1 hover:text-red-400 text-gray-500 rounded transition-all"
                title="Delete session"
                (click)="deleteSession($event, session.id)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
                </svg>
              </button>
            </div>
          }
        }
      </nav>
    </aside>
  `,
})
export class SidebarComponent implements OnInit {
  sessionService = inject(SessionService);
  private router = inject(Router);
  private toast = inject(ToastService);
  loading = signal(true);

  ngOnInit(): void {
    this.sessionService.loadAll().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  navigate(session: Session): void {
    if (session.status === 'ready') {
      this.router.navigate(['/session', session.id]);
    }
  }

  statusLabel(session: Session): string {
    if (session.status === 'ingesting') return 'Ingesting…';
    if (session.status === 'error') return 'Error';
    return `${session.fileCount} files · ${session.chunkCount} chunks`;
  }

  deleteSession(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.sessionService.delete(id).subscribe({
      next: () => {
        this.toast.show('Session deleted', 'success');
        if (this.router.url.includes(id)) {
          this.router.navigate(['/upload']);
        }
      },
      error: () => this.toast.show('Failed to delete session', 'error'),
    });
  }
}
