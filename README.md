# Codebase Assistant

An AI-powered web application that lets you upload any GitHub repository or ZIP file and instantly ask questions about it. The agent searches the codebase semantically, reads files, runs code, and suggests diffs — all grounded in your actual code.

**Live:** [codeassist.tarun.win](https://codeassist.tarun.win)

---

## What It Does

| Feature | Description |
|---|---|
| **Ingest** | Paste a GitHub URL or drop a ZIP → backend clones, chunks, embeds, and indexes every file |
| **Semantic search** | Ask in plain English — the agent finds relevant code across the entire repo |
| **Agentic reasoning** | Multi-step tool use: search → read → reason → answer, autonomously |
| **Streaming responses** | Tokens stream in real-time with live "thinking" indicators |
| **Source citations** | Every answer links back to the exact file and line numbers it used |
| **Code suggestions** | Agent generates unified diffs when asked to fix or refactor |
| **Code execution** | Runs JavaScript/TypeScript snippets in a sandboxed VM to verify hypotheses |
| **File tree viewer** | Browse the repo structure; retrieved files are highlighted after each query |
| **Session management** | Multiple repos open at once, persisted across server restarts |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              Browser (Angular 19)             │
│  Upload · Chat · File Tree · Diff Viewer      │
└─────────────────────┬────────────────────────┘
                      │  REST + SSE
┌─────────────────────▼────────────────────────┐
│           Backend (Node.js + Express)         │
│                                               │
│  Ingest Pipeline          Agent Loop          │
│  clone/unzip              search_codebase     │
│  chunk (800 tok)          read_file           │
│  embed (OpenAI)           write_suggestion    │
│  upsert (Pinecone)        run_code            │
└──────┬────────────────────────┬───────────────┘
       │                        │
┌──────▼──────┐        ┌────────▼────────┐
│  Pinecone   │        │  OpenAI API     │
│  Vector DB  │        │  embeddings +   │
│  (cosine,   │        │  chat (GPT-4o)  │
│   1536-dim) │        └─────────────────┘
└─────────────┘
       │
┌──────▼──────┐
│   SQLite    │
│  (sessions, │
│   files,    │
│   messages) │
└─────────────┘
```

### Communication Flow

```
User types question
      │
      ▼
POST /api/chat/:sessionId/message
      │ returns { streamId }
      ▼
GET /api/chat/:sessionId/stream/:streamId   ← EventSource (SSE)
      │
      ▼  Agent loop (up to 8 iterations)
      ├─ tool call: search_codebase  → Pinecone query → emit "thinking" + "citation" events
      ├─ tool call: read_file        → SQLite lookup  → emit "thinking" event
      ├─ tool call: write_suggestion → diff package   → emit "suggestion" event
      └─ tool call: run_code         → Node vm sandbox → emit "code_result" event
      │
      ▼  Final answer streams token-by-token
      └─ emit "token" events → emit "done"
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19, Tailwind CSS 3, Signals, OnPush change detection |
| Backend | Node.js 24, Express 4, TypeScript 5.4 |
| LLM | OpenAI GPT-4o (chat + tool use) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Vector DB | Pinecone (cosine metric, namespaced per session) |
| Session store | SQLite via `node:sqlite` (Node 22+ built-in) |
| Code sandbox | Node.js `vm` module (restricted — no `require`, no `fs`, no network) |
| Hosting | GitHub Pages (frontend) + Render (backend) |

---

## Project Structure

```
codebase-assistant/
├── backend/
│   └── src/
│       ├── config/
│       │   ├── env.ts              Zod-validated env (fail-fast on missing keys)
│       │   └── constants.ts        Chunk sizes, batch limits, file filters
│       ├── controllers/
│       │   ├── chat.controller.ts  POST message → streamId; GET SSE stream
│       │   ├── ingest.controller.ts Clone/unzip → chunk → embed → index
│       │   └── session.controller.ts CRUD on sessions
│       ├── middleware/
│       │   ├── auth.middleware.ts  Optional X-API-Key enforcement
│       │   ├── error.middleware.ts Global AppError handler
│       │   └── upload.middleware.ts Multer: ZIP only, 50 MB max
│       ├── routes/
│       │   ├── chat.routes.ts
│       │   ├── ingest.routes.ts
│       │   └── session.routes.ts
│       ├── services/
│       │   ├── agent.service.ts    Tool loop + streaming final answer
│       │   ├── cleanup.service.ts  Auto-delete sessions older than N days
│       │   ├── pinecone.service.ts Upsert / query / deleteNamespace
│       │   ├── progress.service.ts In-memory ingestion progress map
│       │   ├── retrieval.service.ts Embed query → Pinecone → ranked chunks
│       │   ├── semaphore.service.ts Concurrent ingestion limiter
│       │   ├── session.service.ts  SQLite CRUD (sessions, files, messages)
│       │   ├── stream.service.ts   SSE stream registry (streamId → Response)
│       │   ├── tools.service.ts    Tool definitions + dispatcher
│       │   └── ingestion/
│       │       ├── cloner.ts       git clone --depth=1 OR adm-zip extract
│       │       ├── chunker.ts      Sliding window chunker (800 tok, 150 overlap)
│       │       ├── embedder.ts     OpenAI batch embeddings (100/call)
│       │       └── indexer.ts      Pinecone upsert (100 vectors/batch)
│       ├── types/
│       │   ├── agent.types.ts      Message, Citation, SSEEvent, SSEEventType
│       │   ├── chunk.types.ts      CodeChunk, VectorMetadata
│       │   ├── errors.ts           AppError, IngestionError, SessionNotFoundError
│       │   └── session.types.ts    Session, FileTreeNode, IngestionProgress
│       └── utils/
│           ├── fileFilter.ts       shouldIncludeFile(), detectLanguage()
│           ├── fileTree.ts         buildFileTree(paths[]) → FileTreeNode[]
│           ├── streamHelper.ts     initSSE(), sendSSE(), endSSE()
│           └── tokenCounter.ts     estimateTokens() — 4 chars ≈ 1 token
│
├── frontend/
│   └── src/app/
│       ├── core/
│       │   ├── models/
│       │   │   ├── message.model.ts  Message, Citation, SSEEvent types
│       │   │   └── session.model.ts  Session, FileTreeNode, IngestionProgress
│       │   ├── services/
│       │   │   ├── api.service.ts    Base HTTP wrapper
│       │   │   ├── chat.service.ts   POST→streamId→EventSource SSE handler
│       │   │   ├── ingest.service.ts URL/ZIP upload + status polling
│       │   │   ├── session.service.ts Signal-based session store
│       │   │   └── toast.service.ts  Signal-based toast queue
│       │   ├── interceptors/
│       │   │   └── error.interceptor.ts HTTP errors → toast
│       │   └── guards/
│       │       └── session.guard.ts  Validates session before chat route
│       ├── features/
│       │   ├── upload/               GitHub URL + ZIP drag-and-drop + progress
│       │   ├── chat/
│       │   │   ├── chat.component.ts Main chat panel (streaming, tool events)
│       │   │   ├── message/          Bubble with inline code block parsing
│       │   │   └── citations/        Source chip row per AI message
│       │   ├── file-tree/            Recursive collapsible tree, highlighted paths
│       │   └── diff-viewer/          Syntax-coloured unified diff per suggestion
│       ├── layout/
│       │   ├── header/               Top bar + hamburger (mobile)
│       │   └── sidebar/              Session list with delete; slide-over on mobile
│       └── shared/components/
│           ├── code-block/           Code block with copy button
│           ├── skeleton/             Pulse skeleton for loading states
│           ├── spinner/              SVG spinner (sm / md / lg)
│           └── toast/                Animated toast stack (bottom-right)
│
├── .github/workflows/
│   └── deploy-frontend.yml   Build Angular → push to gh-pages on main push
├── render.yaml               Render.com backend service config
└── PROJECT_MEMORY.md         Shared dev memory (architecture decisions, status)
```

---

## API Reference

### Ingest

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ingest/url` | Start ingestion from GitHub URL |
| `POST` | `/api/ingest/upload` | Start ingestion from ZIP file |
| `GET` | `/api/ingest/:sessionId/status` | Poll ingestion progress |

**POST /api/ingest/url**
```json
// Request
{ "repoUrl": "https://github.com/owner/repo" }

// Response
{ "sessionId": "sess_abc123", "status": "ingesting" }
```

**GET /api/ingest/:sessionId/status**
```json
{
  "sessionId": "sess_abc123",
  "status": "ingesting",
  "progress": { "step": "embedding", "current": 142, "total": 380, "percent": 37 }
}
```

### Sessions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session + file tree |
| `DELETE` | `/api/sessions/:id` | Delete session + Pinecone namespace |

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/:sessionId/message` | Send message, returns `{ streamId }` |
| `GET` | `/api/chat/:sessionId/stream/:streamId` | Open SSE stream |
| `GET` | `/api/chat/:sessionId/history` | Get message history |
| `DELETE` | `/api/chat/:sessionId/history` | Clear history |

**SSE Event Stream**
```
data: {"type":"thinking","tool":"search_codebase","query":"auth middleware"}
data: {"type":"citation","filePath":"src/auth/guard.ts","startLine":12,"endLine":45,"score":0.41}
data: {"type":"thinking","tool":"read_file","filePath":"src/auth/guard.ts"}
data: {"type":"token","content":"The authentication"}
data: {"type":"token","content":" issue is on line 42"}
data: {"type":"suggestion","filePath":"src/auth/guard.ts","diff":"--- a/...","summary":"Fix null check"}
data: {"type":"done","tokensUsed":1840}
data: [DONE]
```

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (used by Render + self-ping keepalive) |

---

## Agent Tools

The agent runs a ReAct-style tool loop (max 8 iterations) before streaming its final answer.

| Tool | When the agent uses it | Output |
|---|---|---|
| `search_codebase` | First call on every question — finds relevant chunks via Pinecone | Ranked code chunks with file + line metadata |
| `read_file` | When a full file is needed beyond what search returned | Complete file content from SQLite |
| `write_suggestion` | When asked to fix, refactor, or optimise | Unified diff patch — downloadable as `.patch` file |
| `run_code` | To verify a hypothesis or reproduce a bug | stdout / stderr / exit code |
| `search_docs` | When the codebase lacks context about an external dependency | Top web results + synthesised answer via Tavily |

**`run_code` execution:** Node.js `vm` sandbox — **JavaScript and TypeScript only**, 5s timeout, no `require`/`fs`/network.

**`search_docs` availability:** Only registered when `TAVILY_API_KEY` is set. The agent won't see or try to use it otherwise.

---

## Ingestion Pipeline

```
GitHub URL / ZIP file
        │
        ▼
   git clone --depth=1  OR  adm-zip extract
        │
        ▼
   File filter
   • Skip dirs:  node_modules, .git, dist, build, .next, coverage, vendor, .venv
   • Skip exts:  images, fonts, archives, binaries, .lock files
   • Skip files: > 500 KB
   • Max files:  1000 per repo
        │
        ▼
   Sliding window chunker
   • Window: 800 tokens  (4 chars ≈ 1 token)
   • Overlap: 150 tokens
   • Split preference: class → function → export → blank line → newline
        │
        ▼
   OpenAI batch embeddings
   • Model: text-embedding-3-small (1536-dim)
   • Batch: 100 chunks per API call
        │
        ▼
   Pinecone upsert
   • Namespace = sessionId  (complete isolation between repos)
   • Batch: 100 vectors per upsert call
   • Metadata: filePath, language, startLine, endLine, chunkText
        │
        ▼
   SQLite: store full file content
   (so read_file works after the cloned repo is deleted)
```

---

## SQLite Schema

```sql
sessions   id, repo_name, repo_url, created_at, status,
           file_count, chunk_count, vector_count, file_tree (JSON), error_message

files      id, session_id, file_path, content, language
           -- full content stored so read_file works post-ingestion

messages   id, session_id, role, content, citations (JSON), created_at
```

---

## Local Development

### Prerequisites

- Node.js 22+ (for `node:sqlite` built-in)
- npm 10+
- Angular CLI 19: `npm i -g @angular/cli`
- Accounts + API keys: [OpenAI](https://platform.openai.com), [Pinecone](https://pinecone.io)

### Backend

```bash
cd backend
cp .env.example .env    # fill in your API keys
npm install
npm run dev             # tsx watch, hot reload on :3000
```

### Frontend

```bash
cd frontend
npm install
ng serve                # http://localhost:4200
```

The dev frontend proxies API calls to `http://localhost:3000` via `environment.ts`.

### Environment Variables

```bash
# backend/.env

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# LLM
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# Vector DB
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=codebase-assistant

# Storage
SESSION_DB_PATH=./data/sessions.db
TEMP_CLONE_DIR=./tmp/repos

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_REPO_SIZE_MB=50
MAX_CONCURRENT_INGESTIONS=3

# Optional — set to require X-API-Key header on all /api routes
# API_KEY=your-secret-key

# Auto-delete sessions older than N days (0 = disabled)
SESSION_MAX_AGE_DAYS=7

# Optional — enables search_docs tool (web search for library/framework docs)
# TAVILY_API_KEY=your-tavily-key
```

---

## Deployment

### Frontend — GitHub Pages

Deployed automatically via GitHub Actions on every push to `main` that touches `frontend/`.

```
.github/workflows/deploy-frontend.yml
  → ng build --configuration=production
  → copy index.html → 404.html  (SPA routing fix)
  → push to gh-pages branch
  → custom domain: codeassist.tarun.win
```

DNS setup (at your registrar):
```
Type:  CNAME
Name:  codeassist
Value: <your-github-username>.github.io
```

Then in GitHub repo → Settings → Pages: set custom domain and enable HTTPS.

### Backend — Render

Configured via `render.yaml` at the repo root.

| Setting | Value |
|---|---|
| Runtime | Node.js |
| Root Directory | `backend` |
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |

> `--include=dev` is required because Render sets `NODE_ENV=production` which skips `devDependencies` — but `tsc` and `@types/*` are needed at build time.

Set these environment variables in the Render dashboard (never commit secrets):
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- All others can use the defaults from `render.yaml`

**Cold start mitigation:** The backend pings its own `/health` endpoint every 10 minutes in production, keeping the Render free tier warm.

---

## Key Design Decisions

**`node:sqlite` instead of `better-sqlite3`**
`better-sqlite3` requires native compilation and has no prebuilt binaries for Node.js v24 on arm64. `node:sqlite` is built into Node 22+ with an identical synchronous API and zero native dependencies.

**No score threshold — top-K ranking only**
`text-embedding-3-small` scores natural language queries against code chunks in the 0.25–0.45 range. Any hard threshold blocks all results. Relative ranking via `topK` is the correct filter — the highest-scored chunks are the most relevant regardless of absolute score.

**POST → streamId → GET SSE (not POST → SSE direct)**
`EventSource` only supports GET requests with no body. The two-step pattern (`POST` to send the message → receive `streamId` → `GET` to open the SSE stream) is the correct solution.

**Pinecone namespace per session**
Each ingested repo gets its own Pinecone namespace equal to its `sessionId`. This gives complete vector isolation between repos, trivial cleanup on delete, and efficient querying without metadata filtering overhead.

**Anthropic SDK imported but OpenAI used for chat**
The backend uses OpenAI for both embeddings and the agent chat loop. The `@anthropic-ai/sdk` package is present as a dependency for future migration to Claude as the chat model.

---

## Security

| Concern | Mitigation |
|---|---|
| Arbitrary code execution | `run_code` uses Node.js `vm` sandbox — no `require`, no `fs`, no network, 5s timeout |
| Path traversal in `read_file` | File content served from SQLite, not the filesystem |
| Large repo DoS | `MAX_REPO_SIZE_MB=50`, `MAX_TOTAL_FILES=1000` enforced at ingest time |
| API key exposure | All keys backend-only, never in the Angular bundle |
| CORS | Restricted to `FRONTEND_URL` only via `cors` middleware |
| Rate limiting | 100 req/15 min per IP via `express-rate-limit` |
| Optional auth | Set `API_KEY` env var to require `X-API-Key` header on all `/api` routes |
| Session isolation | Pinecone namespaces make cross-session data leakage impossible |
