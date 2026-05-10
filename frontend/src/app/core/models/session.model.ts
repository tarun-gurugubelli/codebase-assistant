export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  isHighlighted?: boolean;
  retrievedChunks?: Array<{ startLine: number; endLine: number }>;
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

export interface IngestionProgress {
  sessionId: string;
  status: 'ingesting' | 'ready' | 'error';
  progress?: {
    step: string;
    current: number;
    total: number;
    percent: number;
  };
  errorMessage?: string;
}
