import { Request, Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sessionService } from '../services/session.service';
import { progressService } from '../services/progress.service';
import { semaphoreService } from '../services/semaphore.service';
import { cloneRepo, extractZip, cleanupRepo } from '../services/ingestion/cloner';
import { collectFiles, chunkFiles } from '../services/ingestion/chunker';
import { indexChunks } from '../services/ingestion/indexer';
import { buildFileTree } from '../utils/fileTree';
import { ValidationError } from '../types/errors';

function extractRepoName(repoUrl: string): string {
  return repoUrl.replace(/\.git$/, '').split('/').at(-1) ?? 'unknown-repo';
}

function makeSessionId(): string {
  return `sess_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

async function runIngestion(sessionId: string, repoDir: string, repoName: string): Promise<void> {
  try {
    progressService.set(sessionId, { step: 'filtering', current: 0, total: 0, percent: 0 });

    const files = collectFiles(repoDir, count => {
      progressService.set(sessionId, { step: 'filtering', current: count, total: 0, percent: 0 });
    });

    sessionService.update(sessionId, { fileCount: files.length });
    progressService.set(sessionId, { step: 'chunking', current: 0, total: files.length, percent: 0 });

    const chunks = chunkFiles(files, sessionId, repoName);
    sessionService.update(sessionId, { chunkCount: chunks.length });

    // Persist file contents so read_file tool works after the repo is cleaned up
    for (const file of files) {
      sessionService.saveFile(uuidv4(), sessionId, file.filePath, file.content, file.language);
    }

    progressService.set(sessionId, { step: 'embedding', current: 0, total: chunks.length, percent: 0 });

    await indexChunks(chunks, sessionId, (indexed, total) => {
      const pct = Math.round((indexed / total) * 100);
      progressService.set(sessionId, {
        step: indexed < total ? 'embedding' : 'indexing',
        current: indexed,
        total,
        percent: pct,
      });
    });

    const fileTree = buildFileTree(files.map(f => f.filePath));
    sessionService.update(sessionId, {
      status: 'ready',
      vectorCount: chunks.length,
      fileTree,
    });
    progressService.set(sessionId, { step: 'done', current: chunks.length, total: chunks.length, percent: 100 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ingestion] Session ${sessionId} failed:`, msg);
    sessionService.update(sessionId, { status: 'error', errorMessage: msg });
    progressService.delete(sessionId);
  } finally {
    semaphoreService.release();
    cleanupRepo(sessionId);
  }
}

export const ingestController = {
  async fromUrl(req: Request, res: Response): Promise<void> {
    const { repoUrl } = req.body as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.startsWith('http')) {
      throw new ValidationError('repoUrl must be a valid HTTP(S) URL');
    }

    if (!semaphoreService.canStart()) {
      res.status(429).json({
        error: { code: 'TOO_MANY_INGESTIONS', message: 'Server busy — too many concurrent ingestions' },
      });
      return;
    }

    semaphoreService.acquire();

    const sessionId = makeSessionId();
    const repoName = extractRepoName(repoUrl);
    sessionService.create(sessionId, repoName, repoUrl);

    res.status(202).json({
      sessionId,
      status: 'ingesting',
      message: `Poll /api/ingest/${sessionId}/status for progress`,
    });

    // Fire-and-forget — response already sent
    progressService.set(sessionId, { step: 'cloning', current: 0, total: 1, percent: 0 });
    cloneRepo(repoUrl, sessionId)
      .then(repoDir => runIngestion(sessionId, repoDir, repoName))
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        sessionService.update(sessionId, { status: 'error', errorMessage: msg });
        progressService.delete(sessionId);
        semaphoreService.release();
      });
  },

  async fromUpload(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new ValidationError('A ZIP file is required (field name: file)');
    }

    if (!semaphoreService.canStart()) {
      res.status(429).json({
        error: { code: 'TOO_MANY_INGESTIONS', message: 'Server busy — too many concurrent ingestions' },
      });
      return;
    }

    semaphoreService.acquire();

    const sessionId = makeSessionId();
    const repoName = path.basename(req.file.originalname, '.zip');
    sessionService.create(sessionId, repoName);

    res.status(202).json({
      sessionId,
      status: 'ingesting',
      message: `Poll /api/ingest/${sessionId}/status for progress`,
    });

    const buffer = req.file.buffer;
    progressService.set(sessionId, { step: 'cloning', current: 0, total: 1, percent: 0 });

    extractZip(buffer, sessionId)
      .then(repoDir => runIngestion(sessionId, repoDir, repoName))
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        sessionService.update(sessionId, { status: 'error', errorMessage: msg });
        progressService.delete(sessionId);
        semaphoreService.release();
      });
  },

  async getStatus(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const session = sessionService.get(sessionId);

    if (!session) {
      res.status(404).json({
        error: { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` },
      });
      return;
    }

    const progress = progressService.get(sessionId) ?? (
      session.status === 'ready'
        ? { step: 'done', current: session.vectorCount, total: session.vectorCount, percent: 100 }
        : null
    );

    res.json({ sessionId, status: session.status, errorMessage: session.errorMessage, progress });
  },
};
