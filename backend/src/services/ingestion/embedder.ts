import OpenAI from 'openai';
import { env } from '../../config/env';
import { EMBEDDING_BATCH_SIZE } from '../../config/constants';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function embedTexts(
  texts: string[],
  onProgress?: (embedded: number, total: number) => void,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const response = await openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: batch,
    });

    const sorted = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

    embeddings.push(...sorted);
    onProgress?.(Math.min(i + EMBEDDING_BATCH_SIZE, texts.length), texts.length);
  }

  return embeddings;
}

export async function embedSingleText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: env.EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}
