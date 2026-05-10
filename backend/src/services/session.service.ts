// Uses Node.js built-in node:sqlite (Node 22+) — no native compilation required.
// Suppressed ExperimentalWarning in npm scripts via --no-warnings=ExperimentalWarning.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { Session, FileTreeNode, IngestionProgress } from '../types/session.types';

const dbDir = path.dirname(env.SESSION_DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(env.SESSION_DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Migrate: add progress column if it doesn't exist yet
try { db.exec('ALTER TABLE sessions ADD COLUMN progress TEXT'); } catch { /* already exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    repo_name    TEXT NOT NULL,
    repo_url     TEXT,
    created_at   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'ingesting',
    file_count   INTEGER NOT NULL DEFAULT 0,
    chunk_count  INTEGER NOT NULL DEFAULT 0,
    vector_count INTEGER NOT NULL DEFAULT 0,
    file_tree    TEXT NOT NULL DEFAULT '[]',
    error_message TEXT,
    progress     TEXT
  );

  CREATE TABLE IF NOT EXISTS files (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_path  TEXT NOT NULL,
    content    TEXT NOT NULL,
    language   TEXT NOT NULL DEFAULT 'text',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    citations  TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_files_session    ON files(session_id);
  CREATE INDEX IF NOT EXISTS idx_files_path       ON files(session_id, file_path);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
`);

type DbRow = Record<string, unknown>;

function rowToSession(row: DbRow): Session {
  return {
    id: row.id as string,
    repoName: row.repo_name as string,
    repoUrl: (row.repo_url as string | null) ?? undefined,
    createdAt: row.created_at as string,
    status: row.status as Session['status'],
    fileCount: row.file_count as number,
    chunkCount: row.chunk_count as number,
    vectorCount: row.vector_count as number,
    fileTree: JSON.parse(row.file_tree as string) as FileTreeNode[],
    errorMessage: (row.error_message as string | null) ?? undefined,
  };
}

export const sessionService = {
  create(id: string, repoName: string, repoUrl?: string): Session {
    db.prepare(`
      INSERT INTO sessions (id, repo_name, repo_url, created_at, status)
      VALUES (?, ?, ?, ?, 'ingesting')
    `).run(id, repoName, repoUrl ?? null, new Date().toISOString());
    return this.getOrThrow(id);
  },

  get(id: string): Session | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbRow | undefined;
    return row ? rowToSession(row) : null;
  },

  getOrThrow(id: string): Session {
    const s = this.get(id);
    if (!s) throw new Error(`Session ${id} not found`);
    return s;
  },

  list(): Session[] {
    return (db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as DbRow[]).map(rowToSession);
  },

  update(id: string, updates: Partial<Pick<Session, 'status' | 'fileCount' | 'chunkCount' | 'vectorCount' | 'fileTree' | 'errorMessage'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined)       { fields.push('status = ?');        values.push(updates.status); }
    if (updates.fileCount !== undefined)    { fields.push('file_count = ?');    values.push(updates.fileCount); }
    if (updates.chunkCount !== undefined)   { fields.push('chunk_count = ?');   values.push(updates.chunkCount); }
    if (updates.vectorCount !== undefined)  { fields.push('vector_count = ?');  values.push(updates.vectorCount); }
    if (updates.fileTree !== undefined)     { fields.push('file_tree = ?');     values.push(JSON.stringify(updates.fileTree)); }
    if (updates.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(updates.errorMessage); }

    if (fields.length === 0) return;
    values.push(id);
    // Cast to SQLInputValue[] — all pushed values are string | number | null
    db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...(values as (string | number | null)[]));
  },

  delete(id: string): void {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  },

  saveFile(id: string, sessionId: string, filePath: string, content: string, language: string): void {
    db.prepare(`
      INSERT OR REPLACE INTO files (id, session_id, file_path, content, language)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, filePath, content, language);
  },

  getFile(sessionId: string, filePath: string): { content: string; language: string } | null {
    const row = db.prepare(
      'SELECT content, language FROM files WHERE session_id = ? AND file_path = ?'
    ).get(sessionId, filePath) as { content: string; language: string } | undefined;
    return row ?? null;
  },

  addMessage(id: string, sessionId: string, role: 'user' | 'assistant', content: string, citations: object[] = []): void {
    db.prepare(`
      INSERT INTO messages (id, session_id, role, content, citations, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, JSON.stringify(citations), new Date().toISOString());
  },

  getMessages(sessionId: string): Array<{ id: string; role: string; content: string; citations: object[]; createdAt: string }> {
    return (db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as DbRow[]).map(row => ({
      id: row.id as string,
      role: row.role as string,
      content: row.content as string,
      citations: JSON.parse(row.citations as string) as object[],
      createdAt: row.created_at as string,
    }));
  },

  clearMessages(sessionId: string): void {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  },

  setProgress(sessionId: string, progress: IngestionProgress): void {
    db.prepare('UPDATE sessions SET progress = ? WHERE id = ?').run(
      JSON.stringify(progress), sessionId,
    );
  },

  getProgress(sessionId: string): IngestionProgress | null {
    const row = db.prepare('SELECT progress FROM sessions WHERE id = ?').get(sessionId) as
      { progress: string | null } | undefined;
    if (!row?.progress) return null;
    return JSON.parse(row.progress) as IngestionProgress;
  },
};
