import { pineconeService } from './pinecone.service';
import { embedSingleText } from './ingestion/embedder';
import { RETRIEVAL_TOP_K, RETRIEVAL_RETURN_COUNT } from '../config/constants';
import { CodeChunk } from '../types/chunk.types';

export interface RetrievedChunk extends CodeChunk {
  score: number;
}

export async function retrieveRelevantChunks(
  query: string,
  sessionId: string,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedSingleText(query);

  const results = await pineconeService.query(sessionId, queryEmbedding, RETRIEVAL_TOP_K);

  // No hard score cutoff — relative ranking matters more than absolute score.
  // text-embedding-3-small scores code chunks in the 0.25–0.45 range for NL queries.
  return results.matches
    .filter(m => m.metadata)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, RETRIEVAL_RETURN_COUNT)
    .map(m => ({
      id: m.id,
      sessionId: m.metadata!.sessionId as string,
      filePath: m.metadata!.filePath as string,
      language: m.metadata!.language as string,
      startLine: m.metadata!.startLine as number,
      endLine: m.metadata!.endLine as number,
      chunkIndex: m.metadata!.chunkIndex as number,
      repoName: m.metadata!.repoName as string,
      chunkText: m.metadata!.chunkText as string,
      score: m.score ?? 0,
    }));
}
