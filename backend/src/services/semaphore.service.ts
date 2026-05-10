import { env } from '../config/env';

// In-memory semaphore for concurrent ingestion limiting.
// Single-server only — a distributed deployment would need Redis or a DB flag.
let active = 0;

export const semaphoreService = {
  canStart(): boolean {
    return active < env.MAX_CONCURRENT_INGESTIONS;
  },

  acquire(): void {
    active++;
  },

  release(): void {
    active = Math.max(0, active - 1);
  },

  activeCount(): number {
    return active;
  },
};
