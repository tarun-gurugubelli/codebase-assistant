import { Response } from 'express';

interface StreamContext {
  queue: string[];       // events buffered before client connects
  res: Response | null;  // connected SSE response (null until GET arrives)
  done: boolean;
}

// In-memory map keyed by streamId — cleaned up 30s after stream ends
const streams = new Map<string, StreamContext>();

export const streamService = {
  create(streamId: string): void {
    streams.set(streamId, { queue: [], res: null, done: false });

    // Safety cleanup if client never connects
    setTimeout(() => streams.delete(streamId), 120_000);
  },

  push(streamId: string, data: object): void {
    const ctx = streams.get(streamId);
    if (!ctx) return;

    const line = `data: ${JSON.stringify(data)}\n\n`;

    if (ctx.res) {
      ctx.res.write(line);
    } else {
      ctx.queue.push(line);
    }
  },

  // Returns false if streamId is unknown
  connect(streamId: string, res: Response): boolean {
    const ctx = streams.get(streamId);
    if (!ctx) return false;

    ctx.res = res;

    // Flush events that arrived before the client connected
    for (const line of ctx.queue) res.write(line);
    ctx.queue = [];

    // Agent may have already finished before client connected
    if (ctx.done) {
      res.write('data: [DONE]\n\n');
      res.end();
    }

    return true;
  },

  end(streamId: string): void {
    const ctx = streams.get(streamId);
    if (!ctx) return;

    ctx.done = true;

    if (ctx.res) {
      ctx.res.write('data: [DONE]\n\n');
      ctx.res.end();
    }

    setTimeout(() => streams.delete(streamId), 30_000);
  },
};
