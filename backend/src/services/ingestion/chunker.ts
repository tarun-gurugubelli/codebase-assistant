import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CHUNK_CONFIG, MAX_TOTAL_FILES } from '../../config/constants';
import { shouldIncludeFile, detectLanguage } from '../../utils/fileFilter';
import { estimateTokens } from '../../utils/tokenCounter';
import { CodeChunk } from '../../types/chunk.types';

export interface RawFile {
  filePath: string;
  content: string;
  language: string;
}

export function collectFiles(repoDir: string, onProgress?: (count: number) => void): RawFile[] {
  const files: RawFile[] = [];

  function walk(dir: string) {
    if (files.length >= MAX_TOTAL_FILES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (files.length >= MAX_TOTAL_FILES) break;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        let stat: fs.Stats;
        try { stat = fs.statSync(fullPath); } catch { continue; }

        if (!shouldIncludeFile(relativePath, stat.size)) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ filePath: relativePath, content, language: detectLanguage(fullPath) });
          onProgress?.(files.length);
        } catch {
          // Skip files with encoding issues or race conditions
        }
      }
    }
  }

  walk(repoDir);
  return files;
}

export function chunkFile(file: RawFile, sessionId: string, repoName: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const { maxTokens, overlapTokens } = CHUNK_CONFIG;
  const lines = file.content.split('\n');

  let chunkLines: string[] = [];
  let chunkStartLine = 1;
  let chunkIndex = 0;
  let tokenCount = 0;

  function flush(endLine: number) {
    const text = chunkLines.join('\n').trim();
    if (!text) return;
    chunks.push({
      id: uuidv4(),
      sessionId,
      filePath: file.filePath,
      language: file.language,
      startLine: chunkStartLine,
      endLine,
      chunkIndex: chunkIndex++,
      repoName,
      chunkText: text,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = estimateTokens(lines[i]);

    if (tokenCount + lineTokens > maxTokens && chunkLines.length > 0) {
      flush(i);

      // Build overlap from the end of the flushed chunk
      const overlapLines: string[] = [];
      let overlapCount = 0;
      for (let j = chunkLines.length - 1; j >= 0; j--) {
        const t = estimateTokens(chunkLines[j]);
        if (overlapCount + t > overlapTokens) break;
        overlapLines.unshift(chunkLines[j]);
        overlapCount += t;
      }

      chunkLines = [...overlapLines, lines[i]];
      chunkStartLine = i + 1 - overlapLines.length;
      tokenCount = overlapCount + lineTokens;
    } else {
      chunkLines.push(lines[i]);
      tokenCount += lineTokens;
    }
  }

  if (chunkLines.length > 0) flush(lines.length);

  return chunks;
}

export function chunkFiles(files: RawFile[], sessionId: string, repoName: string): CodeChunk[] {
  return files.flatMap(file => chunkFile(file, sessionId, repoName));
}
