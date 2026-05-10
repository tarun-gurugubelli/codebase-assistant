import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-screen overflow-hidden">
      <app-header (menuToggle)="toggleSidebar()" />

      <div class="flex flex-1 overflow-hidden relative">
        <!-- Mobile overlay backdrop -->
        @if (sidebarOpen()) {
          <div
            class="fixed inset-0 bg-black/60 z-20 md:hidden"
            (click)="sidebarOpen.set(false)"
          ></div>
        }

        <!-- Sidebar: always visible on md+, drawer on mobile -->
        <div
          class="fixed md:relative z-30 md:z-auto h-full transition-transform duration-200 md:translate-x-0"
          [class.-translate-x-full]="!sidebarOpen()"
          [class.translate-x-0]="sidebarOpen()"
        >
          <app-sidebar (close)="sidebarOpen.set(false)" />
        </div>

        <main class="flex-1 overflow-hidden flex flex-col bg-gray-950 min-w-0">
          <router-outlet />
        </main>
      </div>

      <app-toast />
    </div>
  `,
})
export class AppComponent {
  sidebarOpen = signal(false);
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
}
