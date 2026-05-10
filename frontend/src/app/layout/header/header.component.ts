import { Component, inject, output, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ThemeService } from '../../core/services/theme.service';

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

      <div class="flex items-center gap-2 shrink-0">
        <!-- Dark/light mode toggle -->
        <button
          class="btn-ghost p-1.5"
          aria-label="Toggle theme"
          (click)="themeService.toggle()"
        >
          @if (themeService.isDark()) {
            <!-- Sun icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          } @else {
            <!-- Moon icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          }
        </button>
        <a routerLink="/upload" class="btn-primary text-xs py-1.5">+ New</a>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  sessionService = inject(SessionService);
  themeService = inject(ThemeService);
  menuToggle = output();
}
