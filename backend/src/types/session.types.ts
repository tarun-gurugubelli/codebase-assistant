export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  language?: string;
}

export interface Session {
  id: string;
  repoName: string;
  repoUrl?: string;
  createdAt: string;
  status: 'ingesting' | 'ready' | 'error';
  fileCount: number;
  chunkCount: number;
  vectorCount: number;
  fileTree: FileTreeNode[];
  errorMessage?: string;
}

export type IngestionStep = 'cloning' | 'filtering' | 'chunking' | 'embedding' | 'indexing' | 'done';

export interface IngestionProgress {
  step: IngestionStep;
  current: number;
  total: number;
  percent: number;
}
