import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex items-center justify-between px-4 h-14 bg-gray-950 border-b border-gray-800 shrink-0">
      <a routerLink="/upload" class="flex items-center gap-2 text-white font-semibold hover:text-brand-400 transition-colors">
        <svg class="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <span class="text-sm">Codebase Assistant</span>
      </a>

      @if (sessionService.activeSession()) {
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          <span class="max-w-48 truncate">{{ sessionService.activeSession()!.repoName }}</span>
        </div>
      }

      <a
        routerLink="/upload"
        class="btn-primary text-xs py-1.5"
      >+ New Session</a>
    </header>
  `,
})
export class HeaderComponent {
  sessionService = inject(SessionService);
}
