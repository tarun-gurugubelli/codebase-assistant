import { IngestionProgress } from '../types/session.types';

// In-memory only — resets on server restart (acceptable for single-server portfolio)
const progressMap = new Map<string, IngestionProgress>();

export const progressService = {
  set(sessionId: string, progress: IngestionProgress): void {
    progressMap.set(sessionId, progress);
  },

  get(sessionId: string): IngestionProgress | null {
    return progressMap.get(sessionId) ?? null;
  },

  delete(sessionId: string): void {
    progressMap.delete(sessionId);
  },
};
