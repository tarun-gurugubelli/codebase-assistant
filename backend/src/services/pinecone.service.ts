import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config/env';
import { VectorMetadata } from '../types/chunk.types';
import { PINECONE_UPSERT_BATCH_SIZE } from '../config/constants';

const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
const index = pinecone.index<VectorMetadata>(env.PINECONE_INDEX_NAME);

export const pineconeService = {
  async upsert(
    namespace: string,
    vectors: Array<{ id: string; values: number[]; metadata: VectorMetadata }>,
  ): Promise<void> {
    const ns = index.namespace(namespace);
    for (let i = 0; i < vectors.length; i += PINECONE_UPSERT_BATCH_SIZE) {
      await ns.upsert(vectors.slice(i, i + PINECONE_UPSERT_BATCH_SIZE));
    }
  },

  async query(namespace: string, vector: number[], topK: number) {
    const ns = index.namespace(namespace);
    return ns.query({ vector, topK, includeMetadata: true });
  },

  async deleteNamespace(namespace: string): Promise<void> {
    try {
      await index.namespace(namespace).deleteAll();
    } catch {
      // Namespace may not exist if ingestion never completed
    }
  },
};
