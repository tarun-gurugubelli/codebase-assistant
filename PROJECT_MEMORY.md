# Codebase Assistant — Project Memory

> Shared memory file. Update this as the project evolves so any Claude session can pick up from here.

---

## Project Goal

AI-powered web app: users upload a GitHub repo URL or ZIP → AI agent answers questions about it using RAG + tool use (find bugs, explain architecture, suggest diffs, run code).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19, Tailwind CSS, Signals, OnPush |
| Backend | Node.js 24 (dev), Express 4, TypeScript 5.4 |
| Vector DB | Pinecone (cosine metric, 1536-dim, namespaced by sessionId) |
| LLM | Claude via Anthropic SDK **directly** (NOT LangChain) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Session Store | SQLite via **`node:sqlite`** (built-in, Node 22+) |
| Code Sandbox | E2B (Phase 4+, optional) |

---

## Critical Architecture Decisions (with rationale)

### node:sqlite built-in (not better-sqlite3, not JSON file)
`better-sqlite3` fails to build on Node.js v24 — no prebuilt arm64 binaries for v24.x, C++20 compile errors with macOS SDK Clang. Used `node:sqlite` (built-in since Node 22): zero native deps, same synchronous API. JSON file (design doc default) is wiped on Render.com restarts. SQLite persists across restarts and stores full file contents in the `files` table so the `read_file` agent tool works after cloned repos are deleted post-ingestion. Run with `--no-warnings=ExperimentalWarning`.

### Anthropic SDK directly over LangChain.js
LangChain's ReAct template wraps prompts in ways that conflict with Claude's native tool-use API and streaming format. Direct SDK gives: first-class `tools` array, clean SSE streaming, no adapter overhead.

### No score threshold — use top-K ranking only
Empirically tested: `text-embedding-3-small` scores NL queries against code chunks in the **0.25–0.45 range**. Any hard threshold (design doc's 0.75, or even 0.6) blocks all results. Relative ranking via `topK` is the right filter — the highest-scored chunks are the most relevant regardless of absolute score. Scores are surfaced in citations for transparency.

### SSE handshake: POST → streamId → GET (not POST→SSE direct)
`EventSource` only supports GET with no request body. Pattern: `POST /api/chat/:id/message` → returns `{ streamId }` → client opens `GET /api/chat/:id/stream/:streamId`. **Not yet implemented** — plain chat (Phase 3) uses synchronous JSON response first.

### Phase order (diverges from design doc's 5 phases)
Design doc bundles agent + tools + streaming into one spike. This is split:

| Phase | Description | Status |
|---|---|---|
| 1 | Backend scaffold (Express + TS + Zod + node:sqlite) | ✅ Done |
| 2 | Ingestion pipeline (clone → chunk → embed → Pinecone) | ✅ Done |
| 3 | Plain RAG chat — embed query → Pinecone → Claude → JSON response | ✅ Done |
| 4a | Agent: `search_codebase` only, no streaming | ✅ Done |
| 4b | SSE streaming of agent thoughts + tokens | ✅ Done |
| 4c | `read_file`, `write_suggestion`, `run_code` tools | ✅ Done |
| 5 | Angular frontend shell | ✅ Done |
| 6 | Polish + production readiness | 🔲 Next |

---

## Backend File Map

```
backend/
  src/
    config/
      env.ts              Zod-validated env (all API keys, limits)
      constants.ts        Chunk config, file filter lists, batch sizes
    controllers/
      ingest.controller.ts  Orchestrates full ingestion pipeline
      session.controller.ts CRUD on sessions
      chat.controller.ts    (Phase 3) RAG query → Claude response
    middleware/
      error.middleware.ts   Global AppError handler
      upload.middleware.ts  Multer: ZIP only, 50MB max
    routes/
      ingest.routes.ts
      session.routes.ts
      chat.routes.ts        (Phase 3)
    services/
      session.service.ts    SQLite CRUD (sessions, files, messages tables)
      pinecone.service.ts   Upsert + query + deleteNamespace
      progress.service.ts   In-memory ingestion progress map
      semaphore.service.ts  In-memory concurrent ingestion limiter
      ingestion/
        cloner.ts           git clone --depth=1 OR adm-zip extract
        chunker.ts          collectFiles() + chunkFile() sliding window
        embedder.ts         OpenAI batch embeddings (100/call)
        indexer.ts          embedTexts → pineconeService.upsert
    types/
      session.types.ts      Session, FileTreeNode, IngestionProgress
      chunk.types.ts        CodeChunk, VectorMetadata
      agent.types.ts        Message, Citation, SSEEvent, SSEEventType
      errors.ts             AppError, IngestionError, SessionNotFoundError, etc.
    utils/
      fileFilter.ts         shouldIncludeFile(), detectLanguage()
      tokenCounter.ts       estimateTokens() — 4 chars ≈ 1 token
      streamHelper.ts       initSSE(), sendSSE(), endSSE()
      fileTree.ts           buildFileTree(filePaths[]) → FileTreeNode[]
    app.ts                  Express factory (helmet, cors, morgan, rate-limit)
    index.ts                Listen on PORT
  data/                     SQLite DB lives here (gitignored)
  tmp/                      Cloned repos (gitignored, auto-deleted post-ingest)
  package.json
  tsconfig.json
  .env.example
```

---

## SQLite Schema

```sql
sessions   id, repo_name, repo_url, created_at, status, file_count,
           chunk_count, vector_count, file_tree (JSON), error_message

files      id, session_id, file_path, content, language
           -- stores full file content so read_file works after repo deleted

messages   id, session_id, role, content, citations (JSON), created_at
```

---

## API Endpoints (implemented)

| Method | Path | Description |
|---|---|---|
| POST | `/api/ingest/url` | Clone + ingest GitHub repo (async) |
| POST | `/api/ingest/upload` | Extract ZIP + ingest (async) |
| GET | `/api/ingest/:sessionId/status` | Poll ingestion progress |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session + file tree |
| DELETE | `/api/sessions/:id` | Delete session + Pinecone namespace |
| GET | `/health` | Health check |

## Agent Tools (Phase 4c)
All 4 tools are in `src/services/tools.service.ts`. The dispatcher `handleToolCall()` is called from `runToolLoop` in `agent.service.ts`.

| Tool | What it does | SSE events emitted |
|---|---|---|
| `search_codebase` | Pinecone semantic search | `thinking` + `citation` per unique chunk |
| `read_file` | Full file from SQLite `files` table | `thinking` |
| `write_suggestion` | Unified diff via `diff` package | `thinking` + `suggestion` |
| `run_code` | JS/TS in Node.js `vm` sandbox (5s timeout) | `thinking` + `code_result` |

`run_code` security: restricted sandbox — no `require`, no `process`, no `fs`, no network. Only `Math`, `JSON`, `console` available.
TypeScript snippets are transpiled via `ts.transpileModule` before vm execution.

## SSE Event Shape (Phase 4b)
```
{"type":"thinking","tool":"search_codebase","query":"...","resultCount":5}  ← tool call
{"type":"citation","filePath":"...","startLine":1,"endLine":10,"score":0.4} ← unique chunk found
{"type":"token","content":"The"}                                             ← answer streaming
{"type":"done","tokensUsed":4603}                                           ← finished
{"type":"suggestion","filePath":"...","diff":"...","summary":"..."}         ← write_suggestion
{"type":"code_result","stdout":"4","stderr":"","exitCode":0}               ← run_code
{"type":"error","error":"..."}                                              ← on failure
data: [DONE]                                                                ← SSE sentinel
```

## Chat flow (Phase 4b)
1. `POST /api/chat/:sessionId/message` → `{ streamId }`
2. Open `GET /api/chat/:sessionId/stream/:streamId` as EventSource
3. Events arrive: thinking → citations → tokens → done

## API Endpoints (planned Phase 3)

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat/:sessionId/message` | RAG query, JSON response | ✅ |
| GET | `/api/chat/:sessionId/history` | Message history | ✅ |
| DELETE | `/api/chat/:sessionId/history` | Clear history | ✅ |

---

## Environment Variables

```bash
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=codebase-assistant
E2B_API_KEY=...           # optional until Phase 4c
SESSION_DB_PATH=./data/sessions.db
TEMP_CLONE_DIR=./tmp/repos
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_REPO_SIZE_MB=50
MAX_CONCURRENT_INGESTIONS=3
```

---

## Chunking Strategy

- Sliding window: 800 tokens, 150 token overlap
- Token estimate: 4 chars ≈ 1 token (no native deps)
- Split preference: `\n\nclass`, `\n\nfunction`, `\n\nexport`, `\n\n`, `\n`
- Skip: `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `__pycache__`, `vendor`, `.venv`
- Skip extensions: images, fonts, archives, binaries, `.lock` files
- Max file size: 500KB; max files per repo: 1000

---

## Known Gaps / TODOs

- [ ] Auth middleware not yet implemented (API key header for production)
- [ ] `search_docs` tool (web search fallback) design TBD
- [ ] Chat history not yet wired to SQLite `messages` table (Phase 3)
- [ ] Semaphore has TOCTOU race — acceptable for single-server portfolio
- [ ] Progress resets on server restart — in-memory only
- [ ] `better-sqlite3` requires node-gyp (native addon). Render.com has build tools by default.

---

## Running Locally

```bash
cd backend
cp .env.example .env   # fill in API keys
npm install
npm run dev            # tsx watch, hot reload on :3000
```
