export const CHUNK_CONFIG = {
  maxTokens: 800,
  overlapTokens: 150,
  splitOn: ['\n\nclass ', '\n\nfunction ', '\n\nexport ', '\n\n', '\n'],
} as const;

export const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '__pycache__', '.pytest_cache', 'vendor', '.venv', 'venv',
  '.cache', '.parcel-cache', 'out', '.turbo',
]);

export const EXCLUDED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.exe', '.bin', '.dll', '.so', '.dylib',
  '.pdf', '.mp4', '.mp3', '.wav', '.avi', '.mov',
  '.DS_Store', '.tsbuildinfo',
]);

export const MAX_FILE_SIZE_KB = 500;
export const MAX_TOTAL_FILES = 1000;

export const EMBEDDING_BATCH_SIZE = 100;
export const PINECONE_UPSERT_BATCH_SIZE = 100;

// No hard score cutoff — text-embedding-3-small scores NL→code matches in 0.25–0.45 range.
// Relative ranking (topK) is the right filter, not an absolute threshold.
export const RETRIEVAL_TOP_K = 8;
export const RETRIEVAL_RETURN_COUNT = 5;
