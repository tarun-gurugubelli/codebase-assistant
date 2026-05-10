import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:4200'),

  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  CHAT_MODEL: z.string().default('gpt-4o-mini'),

  PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
  PINECONE_INDEX_NAME: z.string().default('codebase-assistant'),

  E2B_API_KEY: z.string().optional(),

  SESSION_DB_PATH: z.string().default('./data/sessions.db'),
  TEMP_CLONE_DIR: z.string().default('./tmp/repos'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  MAX_REPO_SIZE_MB: z.string().default('50').transform(Number),
  MAX_CONCURRENT_INGESTIONS: z.string().default('3').transform(Number),

  // Optional: set to require X-API-Key header on all /api routes
  API_KEY: z.string().optional(),

  // Sessions older than this are auto-deleted (0 = disabled)
  SESSION_MAX_AGE_DAYS: z.string().default('7').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
