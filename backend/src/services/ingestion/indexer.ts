import { pineconeService } from '../pinecone.service';
import { embedTexts } from './embedder';
import { CodeChunk, VectorMetadata } from '../../types/chunk.types';

export async function indexChunks(
  chunks: CodeChunk[],
  sessionId: string,
  onProgress?: (indexed: number, total: number) => void,
): Promise<void> {
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(
    chunks.map(c => c.chunkText),
    onProgress,
  );

  const vectors = chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      sessionId: chunk.sessionId,
      filePath: chunk.filePath,
      language: chunk.language,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      chunkIndex: chunk.chunkIndex,
      repoName: chunk.repoName,
      chunkText: chunk.chunkText,
    } satisfies VectorMetadata,
  }));

  await pineconeService.upsert(sessionId, vectors);
}
