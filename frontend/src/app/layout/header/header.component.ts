import { Component, inject, output, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex items-center justify-between px-4 h-14 bg-gray-950 border-b border-gray-800 shrink-0">
      <div class="flex items-center gap-3">
        <!-- Hamburger: mobile only -->
        <button
          class="md:hidden btn-ghost p-1.5"
          aria-label="Toggle menu"
          (click)="menuToggle.emit()"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <a routerLink="/upload" class="flex items-center gap-2 text-white font-semibold hover:text-brand-400 transition-colors">
          <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="text-sm hidden sm:inline">Codebase Assistant</span>
        </a>
      </div>

      @if (sessionService.activeSession()) {
        <div class="flex items-center gap-2 text-sm text-gray-400 min-w-0">
          <span class="w-2 h-2 rounded-full bg-green-500 shrink-0 inline-block"></span>
          <span class="truncate max-w-32 sm:max-w-48">{{ sessionService.activeSession()!.repoName }}</span>
        </div>
      }

      <a routerLink="/upload" class="btn-primary text-xs py-1.5 shrink-0">+ New</a>
    </header>
  `,
})
export class HeaderComponent {
  sessionService = inject(SessionService);
  menuToggle = output();
}
