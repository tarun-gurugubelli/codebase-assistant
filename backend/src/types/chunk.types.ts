export interface CodeChunk {
  id: string;
  sessionId: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  repoName: string;
  chunkText: string;
}

export type VectorMetadata = Omit<CodeChunk, 'id'>;
