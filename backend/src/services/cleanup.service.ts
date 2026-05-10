import { sessionService } from './session.service';
import { pineconeService } from './pinecone.service';
import { env } from '../config/env';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // run every 6 hours

async function deleteExpiredSessions(): Promise<void> {
  if (env.SESSION_MAX_AGE_DAYS === 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - env.SESSION_MAX_AGE_DAYS);

  const expired = sessionService.list().filter(
    s => new Date(s.createdAt) < cutoff
  );

  if (expired.length === 0) return;

  console.log(`[cleanup] Deleting ${expired.length} expired session(s) older than ${env.SESSION_MAX_AGE_DAYS} days`);

  for (const session of expired) {
    try {
      await pineconeService.deleteNamespace(session.id);
      sessionService.delete(session.id);
      console.log(`[cleanup] Deleted session ${session.id} (${session.repoName})`);
    } catch (err) {
      console.error(`[cleanup] Failed to delete session ${session.id}:`, err);
    }
  }
}

export function startCleanupJob(): void {
  // Run once at startup, then on interval
  deleteExpiredSessions().catch(err => console.error('[cleanup] Startup run failed:', err));
  setInterval(() => {
    deleteExpiredSessions().catch(err => console.error('[cleanup] Interval run failed:', err));
  }, CLEANUP_INTERVAL_MS);
}
