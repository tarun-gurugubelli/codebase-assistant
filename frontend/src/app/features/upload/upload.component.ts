import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IngestService } from '../../core/services/ingest.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { IngestionProgress } from '../../core/models/session.model';

type UploadStatus = 'idle' | 'uploading' | 'ingesting' | 'done' | 'error';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [FormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center min-h-full px-4 py-12">
      <div class="w-full max-w-lg space-y-6">

        <div class="text-center space-y-1">
          <h1 class="text-2xl font-semibold text-white">Analyse a Codebase</h1>
          <p class="text-sm text-gray-400">Paste a GitHub URL or upload a ZIP file to get started.</p>
        </div>

        @if (status() === 'idle' || status() === 'error') {
          <!-- URL input -->
          <div class="card p-5 space-y-4">
            <label class="text-xs font-medium text-gray-400 uppercase tracking-wider">GitHub Repository URL</label>
            <div class="flex gap-2">
              <input
                class="input-field"
                type="url"
                placeholder="https://github.com/owner/repo"
                [(ngModel)]="repoUrl"
                (keydown.enter)="submitUrl()"
              />
              <button
                class="btn-primary shrink-0"
                [disabled]="!repoUrl.trim()"
                (click)="submitUrl()"
              >Ingest</button>
            </div>
          </div>

          <div class="flex items-center gap-3 text-gray-600 text-xs">
            <div class="flex-1 h-px bg-gray-800"></div>
            <span>or</span>
            <div class="flex-1 h-px bg-gray-800"></div>
          </div>

          <!-- ZIP drag-drop -->
          <div
            class="card p-8 text-center border-2 border-dashed transition-colors cursor-pointer"
            [class.border-brand-500]="isDragging()"
            [class.bg-brand-900]="isDragging()"
            [class.border-gray-700]="!isDragging()"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging.set(false)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <svg class="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="text-sm text-gray-400">Drag & drop a <span class="text-white font-medium">.zip</span> file here</p>
            <p class="text-xs text-gray-600 mt-1">or click to browse · max 50MB</p>
            <input #fileInput type="file" accept=".zip" class="hidden" (change)="onFileSelect($event)" />
          </div>

          @if (status() === 'error') {
            <p class="text-sm text-red-400 text-center">{{ errorMessage() }}</p>
          }
        }

        @if (status() === 'uploading' || status() === 'ingesting') {
          <div class="card p-8 text-center space-y-4">
            <app-spinner size="lg" class="text-brand-500 mx-auto block" />
            <div>
              <p class="text-white font-medium">{{ statusLabel() }}</p>
              @if (progress(); as p) {
                <p class="text-sm text-gray-400 mt-1">{{ p.step }} · {{ p.current }}/{{ p.total }}</p>
                <div class="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-brand-500 rounded-full transition-all duration-300"
                    [style.width.%]="p.percent"
                  ></div>
                </div>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class UploadComponent {
  private ingest = inject(IngestService);
  private router = inject(Router);
  private toast = inject(ToastService);

  repoUrl = '';
  isDragging = signal(false);
  status = signal<UploadStatus>('idle');
  progress = signal<IngestionProgress['progress'] | null>(null);
  errorMessage = signal('');

  statusLabel(): string {
    return this.status() === 'uploading' ? 'Uploading…' : 'Ingesting codebase…';
  }

  submitUrl(): void {
    const url = this.repoUrl.trim();
    if (!url) return;
    this.status.set('uploading');

    this.ingest.ingestUrl(url).subscribe({
      next: ({ sessionId }) => this.startPolling(sessionId),
      error: () => this.status.set('error'),
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file?.name.endsWith('.zip')) {
      this.uploadZip(file);
    } else {
      this.toast.show('Please drop a .zip file', 'error');
    }
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadZip(file);
  }

  private uploadZip(file: File): void {
    this.status.set('uploading');
    this.ingest.ingestZip(file).subscribe({
      next: ({ sessionId }) => this.startPolling(sessionId),
      error: () => this.status.set('error'),
    });
  }

  private startPolling(sessionId: string): void {
    this.status.set('ingesting');
    this.ingest.pollStatus(sessionId).subscribe({
      next: (res) => {
        this.progress.set(res.progress ?? null);
        if (res.status === 'ready') {
          this.status.set('done');
          this.router.navigate(['/session', sessionId]);
        } else if (res.status === 'error') {
          this.status.set('error');
          this.errorMessage.set(res.errorMessage ?? 'Ingestion failed');
        }
      },
      error: () => {
        this.status.set('error');
        this.errorMessage.set('Failed to check ingestion status');
      },
    });
  }
}
