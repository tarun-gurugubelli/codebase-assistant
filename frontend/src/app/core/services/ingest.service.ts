import { Injectable, inject } from '@angular/core';
import { Observable, interval, switchMap, takeWhile, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { IngestionProgress } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class IngestService {
  private api = inject(ApiService);
  private sessionService = inject(SessionService);

  ingestUrl(repoUrl: string): Observable<{ sessionId: string }> {
    return this.api.post<{ sessionId: string }>('/ingest/url', { repoUrl });
  }

  ingestZip(file: File): Observable<{ sessionId: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.api.postForm<{ sessionId: string }>('/ingest/upload', form);
  }

  pollStatus(sessionId: string): Observable<IngestionProgress> {
    return interval(1500).pipe(
      switchMap(() =>
        this.api.get<IngestionProgress>(`/ingest/${sessionId}/status`)
      ),
      tap(res => {
        if (res.status === 'ready' || res.status === 'error') {
          this.sessionService.loadAll().subscribe();
        }
      }),
      takeWhile(res => res.status === 'ingesting', true)
    );
  }
}
