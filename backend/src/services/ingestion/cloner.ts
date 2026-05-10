import simpleGit from 'simple-git';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { IngestionError } from '../../types/errors';

function sessionDir(sessionId: string): string {
  return path.join(env.TEMP_CLONE_DIR, sessionId);
}

export async function cloneRepo(repoUrl: string, sessionId: string): Promise<string> {
  const target = sessionDir(sessionId);
  fs.mkdirSync(target, { recursive: true });

  try {
    await simpleGit().clone(repoUrl, target, ['--depth=1']);
    return target;
  } catch (err: unknown) {
    fs.rmSync(target, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    throw new IngestionError(`Failed to clone repository: ${msg}`);
  }
}

export async function extractZip(buffer: Buffer, sessionId: string): Promise<string> {
  const target = sessionDir(sessionId);
  fs.mkdirSync(target, { recursive: true });

  try {
    const zip = new AdmZip(buffer);
    zip.extractAllTo(target, true);

    // If the ZIP contained a single root folder, use it directly
    const entries = fs.readdirSync(target);
    if (entries.length === 1) {
      const single = path.join(target, entries[0]);
      if (fs.statSync(single).isDirectory()) return single;
    }
    return target;
  } catch (err: unknown) {
    fs.rmSync(target, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    throw new IngestionError(`Failed to extract ZIP: ${msg}`);
  }
}

export function cleanupRepo(sessionId: string): void {
  const target = path.join(env.TEMP_CLONE_DIR, sessionId);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}
