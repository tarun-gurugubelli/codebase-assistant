import path from 'path';
import { EXCLUDED_DIRS, EXCLUDED_EXTENSIONS, MAX_FILE_SIZE_KB } from '../config/constants';

export function shouldIncludeFile(filePath: string, sizeBytes: number): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  if (parts.some(part => EXCLUDED_DIRS.has(part))) return false;

  const ext = path.extname(filePath).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) return false;

  if (sizeBytes > MAX_FILE_SIZE_KB * 1024) return false;

  return true;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
  '.c': 'c', '.h': 'c',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.md': 'markdown', '.mdx': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.html': 'html', '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss', '.sass': 'scss',
  '.sql': 'sql',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.toml': 'toml',
  '.xml': 'xml',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.proto': 'protobuf',
  '.tf': 'terraform',
  '.dockerfile': 'dockerfile',
};

export function detectLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';

  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] ?? 'text';
}
