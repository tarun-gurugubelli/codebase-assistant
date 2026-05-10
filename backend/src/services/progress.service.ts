import { IngestionProgress } from '../types/session.types';
import { sessionService } from './session.service';

// Writes through to SQLite so progress survives server restarts.
// Falls back gracefully if the session row doesn't exist yet.
export const progressService = {
  set(sessionId: string, progress: IngestionProgress): void {
    try {
      sessionService.setProgress(sessionId, progress);
    } catch {
      // session row not created yet — ignore
    }
  },

  get(sessionId: string): IngestionProgress | null {
    try {
      return sessionService.getProgress(sessionId);
    } catch {
      return null;
    }
  },

  delete(sessionId: string): void {
    try {
      sessionService.setProgress(sessionId, null as unknown as IngestionProgress);
    } catch {
      // ignore
    }
  },
};
