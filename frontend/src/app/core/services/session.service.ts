import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Session } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private api = inject(ApiService);

  readonly sessions = signal<Session[]>([]);
  readonly activeSessionId = signal<string | null>(null);
  readonly activeSession = computed(() =>
    this.sessions().find(s => s.id === this.activeSessionId()) ?? null
  );

  loadAll(): Observable<{ sessions: Session[] }> {
    return this.api.get<{ sessions: Session[] }>('/sessions').pipe(
      tap(res => this.sessions.set(res.sessions ?? []))
    );
  }

  getOne(id: string): Observable<Session> {
    return this.api.get<Session>(`/sessions/${id}`).pipe(
      tap(session => {
        this.sessions.update(list => {
          const idx = list.findIndex(s => s.id === id);
          return idx >= 0 ? list.with(idx, session) : [...list, session];
        });
      })
    );
  }

  setActive(id: string): void {
    this.activeSessionId.set(id);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/sessions/${id}`).pipe(
      tap(() => {
        this.sessions.update(list => list.filter(s => s.id !== id));
        if (this.activeSessionId() === id) this.activeSessionId.set(null);
      })
    );
  }
}
