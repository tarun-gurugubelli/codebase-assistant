# AI-Powered Codebase Assistant — Design Documentation

> **Version:** 1.0.0  
> **Stack:** Angular + Tailwind · Node.js + Express · LangChain.js · Pinecone · OpenAI Embeddings · Claude API · E2B  
> **Target:** Production-Ready Portfolio Application

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Database & Vector Store Design](#4-database--vector-store-design)
5. [Backend Design (Node + Express)](#5-backend-design-node--express)
6. [Agent & RAG Design](#6-agent--rag-design)
7. [Frontend Design (Angular + Tailwind)](#7-frontend-design-angular--tailwind)
8. [API Contract](#8-api-contract)
9. [Environment Variables](#9-environment-variables)
10. [Build Phases & Milestones](#10-build-phases--milestones)
11. [Error Handling Strategy](#11-error-handling-strategy)
12. [Security Considerations](#12-security-considerations)
13. [Performance Optimizations](#13-performance-optimizations)
14. [Deployment Guide](#14-deployment-guide)

---

## 1. Project Overview

### What It Does

A web application where users upload a GitHub repository URL or a ZIP file of code, and an AI agent answers questions about it — finding bugs, suggesting refactors, explaining architecture, and even running code snippets — all grounded in the actual codebase via RAG (Retrieval-Augmented Generation).

### Core User Flows

| Flow         | Description                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **Ingest**   | User pastes a GitHub URL → backend clones repo → chunks + embeds files → stores in Pinecone     |
| **Chat**     | User asks a question → agent retrieves relevant code chunks → reasons → responds with citations |
| **Tool Use** | Agent autonomously decides to read files, run code in sandbox, or search external docs          |
| **Review**   | User sees which files were retrieved, source citations, and suggested diffs                     |

### Key Features

- Semantic search over any codebase
- Multi-step agentic reasoning with tool chaining
- Streamed responses with source citations
- Code execution in a sandboxed environment (E2B)
- File tree viewer with highlighted retrieved chunks
- Diff viewer for suggested code changes
- Session management (multiple repos per user)

---

## 2. System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Angular)                        │
│   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│   │  Upload  │  │   Chat   │  │  File Tree │  │ Diff Viewer │  │
│   │  Panel   │  │   UI     │  │  Viewer    │  │             │  │
│   └────┬─────┘  └────┬─────┘  └─────┬──────┘  └──────┬──────┘  │
└────────┼─────────────┼──────────────┼─────────────────┼─────────┘
         │             │              │                 │
         ▼             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + Express)                    │
│                                                                  │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│   │  Ingestion  │  │  Chat/Agent  │  │   Session Manager     │  │
│   │  Service    │  │  Controller  │  │                       │  │
│   └──────┬──────┘  └──────┬───────┘  └───────────────────────┘  │
│          │                │                                       │
│   ┌──────▼──────┐  ┌──────▼───────┐                              │
│   │  Chunker &  │  │  LangChain   │                              │
│   │  Embedder   │  │  Agent       │                              │
│   └──────┬──────┘  └──────┬───────┘                              │
└──────────┼────────────────┼─────────────────────────────────────┘
           │                │
    ┌──────▼──────┐  ┌──────▼──────────────────────────┐
    │  Pinecone   │  │         External Services        │
    │ Vector DB   │  │  ┌──────────┐  ┌──────────────┐  │
    └─────────────┘  │  │ OpenAI   │  │ Claude API   │  │
                     │  │Embeddings│  │ (LLM)        │  │
                     │  └──────────┘  └──────────────┘  │
                     │  ┌──────────┐  ┌──────────────┐  │
                     │  │  E2B     │  │  GitHub API  │  │
                     │  │ Sandbox  │  │  (clone)     │  │
                     │  └──────────┘  └──────────────┘  │
                     └────────────────────────────────────┘
```

### Communication Patterns

| Channel              | Protocol          | Use Case                   |
| -------------------- | ----------------- | -------------------------- |
| Frontend ↔ Backend   | REST + SSE        | API calls + streaming chat |
| Backend ↔ Pinecone   | HTTPS (SDK)       | Vector upsert and query    |
| Backend ↔ Claude API | HTTPS (SDK)       | LLM inference              |
| Backend ↔ OpenAI     | HTTPS (SDK)       | Embedding generation       |
| Backend ↔ E2B        | HTTPS (SDK)       | Code execution sandbox     |
| Backend ↔ GitHub     | HTTPS (git clone) | Repo ingestion             |

---

## 3. Folder Structure

### Root

```
codebase-assistant/
├── frontend/                  # Angular application
├── backend/                   # Node.js + Express API
├── .env.example               # Environment variable template
├── docker-compose.yml         # Local dev orchestration
└── README.md
```

### Backend

```
backend/
├── src/
│   ├── index.ts               # App entry point
│   ├── app.ts                 # Express app setup, middleware
│   ├── config/
│   │   ├── env.ts             # Validated env config (zod)
│   │   └── constants.ts       # Chunk size, overlap, limits
│   ├── controllers/
│   │   ├── ingest.controller.ts
│   │   ├── chat.controller.ts
│   │   └── session.controller.ts
│   ├── services/
│   │   ├── ingestion/
│   │   │   ├── cloner.ts      # Git clone / ZIP extract
│   │   │   ├── chunker.ts     # File chunking strategy
│   │   │   ├── embedder.ts    # OpenAI embedding calls
│   │   │   └── indexer.ts     # Pinecone upsert logic
│   │   ├── agent/
│   │   │   ├── agent.ts       # LangChain agent definition
│   │   │   ├── tools/
│   │   │   │   ├── searchCodebase.ts
│   │   │   │   ├── readFile.ts
│   │   │   │   ├── runCode.ts
│   │   │   │   ├── writeSuggestion.ts
│   │   │   │   └── searchDocs.ts
│   │   │   └── prompts/
│   │   │       ├── system.prompt.ts
│   │   │       └── tool.prompts.ts
│   │   ├── pinecone.service.ts
│   │   └── session.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts  # API key / rate limiting
│   │   ├── error.middleware.ts
│   │   └── upload.middleware.ts # Multer config
│   ├── routes/
│   │   ├── ingest.routes.ts
│   │   ├── chat.routes.ts
│   │   └── session.routes.ts
│   ├── types/
│   │   ├── session.types.ts
│   │   ├── chunk.types.ts
│   │   └── agent.types.ts
│   └── utils/
│       ├── fileFilter.ts       # Ignore node_modules, .git, etc.
│       ├── tokenCounter.ts
│       └── streamHelper.ts     # SSE helper
├── package.json
├── tsconfig.json
└── .env
```

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts         # Base HTTP client
│   │   │   │   ├── chat.service.ts        # SSE stream handler
│   │   │   │   ├── session.service.ts
│   │   │   │   └── ingest.service.ts
│   │   │   ├── models/
│   │   │   │   ├── message.model.ts
│   │   │   │   ├── session.model.ts
│   │   │   │   └── chunk.model.ts
│   │   │   ├── guards/
│   │   │   │   └── session.guard.ts
│   │   │   └── interceptors/
│   │   │       └── error.interceptor.ts
│   │   ├── features/
│   │   │   ├── upload/
│   │   │   │   ├── upload.component.ts
│   │   │   │   ├── upload.component.html
│   │   │   │   └── upload.component.spec.ts
│   │   │   ├── chat/
│   │   │   │   ├── chat.component.ts
│   │   │   │   ├── chat.component.html
│   │   │   │   ├── message/
│   │   │   │   │   ├── message.component.ts
│   │   │   │   │   └── message.component.html
│   │   │   │   └── citations/
│   │   │   │       ├── citations.component.ts
│   │   │   │       └── citations.component.html
│   │   │   ├── file-tree/
│   │   │   │   ├── file-tree.component.ts
│   │   │   │   └── file-tree.component.html
│   │   │   └── diff-viewer/
│   │   │       ├── diff-viewer.component.ts
│   │   │       └── diff-viewer.component.html
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── spinner/
│   │   │   │   ├── toast/
│   │   │   │   ├── code-block/
│   │   │   │   └── avatar/
│   │   │   └── pipes/
│   │   │       └── highlight.pipe.ts
│   │   ├── layout/
│   │   │   ├── sidebar/
│   │   │   └── header/
│   │   ├── app.routes.ts
│   │   ├── app.config.ts
│   │   └── app.component.ts
│   ├── assets/
│   ├── styles.css             # Tailwind base
│   └── environments/
│       ├── environment.ts
│       └── environment.prod.ts
├── angular.json
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 4. Database & Vector Store Design

### Pinecone Index Schema

**Index Name:** `codebase-assistant`  
**Dimension:** `1536` (OpenAI `text-embedding-3-small`)  
**Metric:** `cosine`

#### Vector Metadata Shape

```typescript
interface VectorMetadata {
  sessionId: string; // Isolates vectors per session/repo
  filePath: string; // e.g., "src/auth/auth.service.ts"
  language: string; // e.g., "typescript"
  startLine: number;
  endLine: number;
  chunkIndex: number; // Position within the file
  repoName: string; // e.g., "my-ecommerce-app"
  chunkText: string; // Raw text of chunk (for citation display)
}
```

#### Namespace Strategy

Each ingested session uses a **Pinecone namespace** equal to its `sessionId`. This ensures:

- Complete isolation between repos
- Easy cleanup (delete namespace on session delete)
- Efficient querying without metadata filtering overhead

```
Namespace: session_abc123
  ├── vec_001  → src/auth/auth.service.ts (lines 1-80)
  ├── vec_002  → src/auth/auth.service.ts (lines 70-150)
  ├── vec_003  → src/app.module.ts (lines 1-60)
  └── ...
```

### Session Store (In-Memory + File)

For the free tier / portfolio scope, sessions are stored in a JSON file on the server with an in-memory cache. For production scale, replace with Redis or PostgreSQL.

```typescript
interface Session {
  id: string;
  repoName: string;
  repoUrl?: string;
  createdAt: Date;
  status: "ingesting" | "ready" | "error";
  fileCount: number;
  chunkCount: number;
  vectorCount: number;
  fileTree: FileTreeNode[];
  errorMessage?: string;
}
```

---

## 5. Backend Design (Node + Express)

### Express App Setup (`app.ts`)

```typescript
// Middleware stack order
app.use(helmet()); // Security headers
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined")); // Request logging
app.use("/api/ingest", ingestRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);
app.use(errorMiddleware); // Global error handler (last)
```

### Routes

#### Ingest Routes

| Method | Path                            | Description             |
| ------ | ------------------------------- | ----------------------- |
| `POST` | `/api/ingest/url`               | Ingest from GitHub URL  |
| `POST` | `/api/ingest/upload`            | Ingest from ZIP upload  |
| `GET`  | `/api/ingest/:sessionId/status` | Poll ingestion progress |

#### Chat Routes

| Method   | Path                           | Description                      |
| -------- | ------------------------------ | -------------------------------- |
| `POST`   | `/api/chat/:sessionId/message` | Send message, returns SSE stream |
| `GET`    | `/api/chat/:sessionId/history` | Get message history              |
| `DELETE` | `/api/chat/:sessionId/history` | Clear chat history               |

#### Session Routes

| Method   | Path                | Description                         |
| -------- | ------------------- | ----------------------------------- |
| `GET`    | `/api/sessions`     | List all sessions                   |
| `GET`    | `/api/sessions/:id` | Get session details + file tree     |
| `DELETE` | `/api/sessions/:id` | Delete session + Pinecone namespace |

### Ingestion Pipeline

```
GitHub URL / ZIP
      │
      ▼
  ┌─────────────┐
  │   Cloner    │  git clone --depth=1 OR extract ZIP
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  File Filter│  Exclude: node_modules, .git, dist, *.lock,
  └──────┬──────┘           images, binaries (by extension)
         │
         ▼
  ┌─────────────┐
  │   Chunker   │  Sliding window: 800 tokens, 150 token overlap
  └──────┬──────┘  Respects function/class boundaries when possible
         │
         ▼
  ┌─────────────┐
  │  Embedder   │  Batch calls to OpenAI (max 100 chunks/call)
  └──────┬──────┘  Model: text-embedding-3-small
         │
         ▼
  ┌─────────────┐
  │   Indexer   │  Upsert to Pinecone namespace=sessionId
  └─────────────┘  Batch size: 100 vectors
```

#### Chunking Strategy

```typescript
const CHUNK_CONFIG = {
  maxTokens: 800,
  overlapTokens: 150,
  // Preferred split points (in order of preference):
  splitOn: ["\n\nclass ", "\n\nfunction ", "\n\nexport ", "\n\n", "\n"],
};
```

#### File Filter Rules

```typescript
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
];
const EXCLUDED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".lock",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".bin",
];
const MAX_FILE_SIZE_KB = 500;
const MAX_TOTAL_FILES = 1000;
```

### Streaming Response (SSE)

Chat responses are streamed using Server-Sent Events:

```typescript
// chat.controller.ts
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

// Events emitted during a response:
// data: {"type":"thinking","tool":"search_codebase","query":"auth middleware"}
// data: {"type":"token","content":"The authentication"}
// data: {"type":"token","content":" is handled in"}
// data: {"type":"citation","filePath":"src/auth/auth.middleware.ts","startLine":12,"endLine":45}
// data: {"type":"done"}
// data: [DONE]
```

---

## 6. Agent & RAG Design

### Agent Architecture (LangChain.js)

The agent uses a **ReAct (Reasoning + Acting)** loop with Claude as the LLM backbone.

```
User Query
    │
    ▼
┌──────────────────────────────────────┐
│            ReAct Loop                │
│                                      │
│  1. THINK: What do I need to know?  │
│  2. ACT:   Choose a tool             │
│  3. OBS:   Read tool result          │
│  4. THINK: Is this enough?           │
│  5. Repeat or ANSWER                 │
└──────────────────────────────────────┘
    │
    ▼
 Response with citations
```

### Agent Tools

#### 1. `search_codebase`

Performs semantic search over the ingested repo.

```typescript
{
  name: "search_codebase",
  description: "Semantically search the codebase for relevant code snippets. Use for finding implementations, understanding patterns, or locating specific functionality.",
  input: { query: string, topK?: number },  // topK default: 5
  output: { chunks: CodeChunk[], filePaths: string[] }
}
```

#### 2. `read_file`

Reads a complete file by its path.

```typescript
{
  name: "read_file",
  description: "Read the full contents of a specific file. Use when you need the complete context of a file found via search_codebase.",
  input: { filePath: string },
  output: { content: string, lineCount: number }
}
```

#### 3. `run_code`

Executes code in an E2B sandbox.

```typescript
{
  name: "run_code",
  description: "Execute a code snippet in an isolated sandbox. Use to verify hypotheses about how code behaves, test a fix, or reproduce a bug.",
  input: { code: string, language: 'javascript' | 'typescript' | 'python' },
  output: { stdout: string, stderr: string, exitCode: number }
}
```

#### 4. `write_suggestion`

Generates a unified diff for a suggested code change.

```typescript
{
  name: "write_suggestion",
  description: "Generate a code improvement suggestion as a diff patch. Use when the user asks for a refactor, bug fix, or optimization.",
  input: { filePath: string, originalCode: string, improvedCode: string, reason: string },
  output: { diff: string, summary: string }
}
```

#### 5. `search_docs`

Searches external documentation (via web search fallback).

```typescript
{
  name: "search_docs",
  description: "Search official documentation for a library or framework. Use when you need to verify an API, check types, or understand a dependency used in the codebase.",
  input: { query: string, library?: string },
  output: { results: DocResult[] }
}
```

### System Prompt

```
You are an expert software engineering assistant. You have access to a codebase
that has been semantically indexed. Your job is to answer questions about the code,
find bugs, suggest improvements, and explain architectural decisions.

Always ground your answers in the actual code. Use search_codebase first before
answering any question. Cite specific file paths and line numbers. If you suggest
a code change, use write_suggestion to provide a proper diff.

Be concise and precise. Developers value accuracy over verbosity.
```

### RAG Retrieval Strategy

```typescript
// Query pipeline
async function retrieve(
  query: string,
  sessionId: string,
): Promise<CodeChunk[]> {
  // 1. Embed the query
  const queryEmbedding = await embedder.embed(query);

  // 2. Query Pinecone with metadata filter
  const results = await pinecone.query({
    namespace: sessionId,
    vector: queryEmbedding,
    topK: 8,
    includeMetadata: true,
  });

  // 3. Re-rank by combining vector score + recency of file changes (if available)
  const reranked = results.matches
    .filter((m) => m.score > 0.75) // Score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return reranked.map((m) => m.metadata as VectorMetadata);
}
```

---

## 7. Frontend Design (Angular + Tailwind)

### Angular Version & Config

- **Angular:** 19 (Standalone components, new control flow syntax)
- **Change Detection:** OnPush throughout
- **State:** Angular Signals (`signal`, `computed`, `effect`)
- **Routing:** Lazy-loaded feature routes
- **HTTP:** `HttpClient` with typed responses

### Application Layout

```
┌──────────────────────────────────────────────────┐
│                    Header                         │
│  [Logo]  [Session Name]          [New Session]    │
├─────────────┬────────────────────┬───────────────┤
│             │                    │               │
│  Sidebar    │    Chat Panel      │  Code Panel   │
│  (Sessions) │                    │  (File Tree / │
│             │  ┌──────────────┐  │   Diff View)  │
│  ─────────  │  │  Messages    │  │               │
│  [Session1] │  │              │  │  src/         │
│  [Session2] │  │  [AI Msg]    │  │  ├── auth/    │
│  [Session3] │  │  [User Msg]  │  │  │   └── ...  │
│             │  │  [AI Msg]    │  │  └── app/     │
│             │  └──────────────┘  │               │
│             │  ┌──────────────┐  │  [Chunk       │
│             │  │  Input Bar   │  │   Highlight]  │
│             │  └──────────────┘  │               │
└─────────────┴────────────────────┴───────────────┘
```

### Key Components

#### `UploadComponent`

Handles both GitHub URL input and ZIP drag-and-drop.

**Signals:**

```typescript
repoUrl = signal("");
isDragging = signal(false);
uploadStatus = signal<"idle" | "uploading" | "processing" | "done" | "error">(
  "idle",
);
progress = signal(0);
```

**Template (new control flow):**

```html
@if (uploadStatus() === 'idle') {
<!-- URL input + drag-drop zone -->
} @else if (uploadStatus() === 'processing') {
<!-- Progress bar with step indicators -->
} @else if (uploadStatus() === 'done') {
<!-- Success state, redirect to chat -->
}
```

#### `ChatComponent`

The main chat interface with streaming support.

**Signals:**

```typescript
messages = signal<Message[]>([]);
isStreaming = signal(false);
activeCitations = signal<Citation[]>([]);
inputText = signal("");
```

**Streaming with SSE:**

```typescript
sendMessage(text: string) {
  const eventSource = new EventSource(`/api/chat/${sessionId}/message?q=${text}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'token') {
      // Append token to last message
    } else if (data.type === 'citation') {
      // Update citations panel
    } else if (data.type === 'done') {
      eventSource.close();
    }
  };
}
```

#### `FileTreeComponent`

Recursive file tree with highlighted retrieved chunks.

```typescript
interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  isHighlighted?: boolean; // True if retrieved in last query
  retrievedChunks?: number[]; // Line ranges retrieved
}
```

#### `DiffViewerComponent`

Displays suggested code changes from the `write_suggestion` tool.

- Uses `diff2html` library for rendering
- Toggle between unified and split view
- Copy to clipboard button
- Apply suggestion flow (downloads patched file)

### Routing

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: "", redirectTo: "/upload", pathMatch: "full" },
  {
    path: "upload",
    loadComponent: () =>
      import("./features/upload/upload.component").then(
        (m) => m.UploadComponent,
      ),
  },
  {
    path: "session/:id",
    loadComponent: () =>
      import("./features/chat/chat.component").then((m) => m.ChatComponent),
    canActivate: [sessionGuard],
  },
  { path: "**", redirectTo: "/upload" },
];
```

### Tailwind Theme Config

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          500: "#4f6ef7",
          900: "#1a237e",
        },
        code: {
          bg: "#1e1e2e", // Dark editor background
          highlight: "#2d2d4e", // Retrieved chunk highlight
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
};
```

---

## 8. API Contract

### `POST /api/ingest/url`

**Request:**

```json
{
  "repoUrl": "https://github.com/user/my-project",
  "branch": "main"
}
```

**Response:**

```json
{
  "sessionId": "sess_abc123",
  "status": "ingesting",
  "message": "Ingestion started. Poll /api/ingest/sess_abc123/status for updates."
}
```

---

### `GET /api/ingest/:sessionId/status`

**Response:**

```json
{
  "sessionId": "sess_abc123",
  "status": "ingesting",
  "progress": {
    "step": "embedding",
    "current": 142,
    "total": 380,
    "percent": 37
  }
}
```

---

### `POST /api/chat/:sessionId/message`

**Request:**

```json
{
  "message": "Why is the authentication broken?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**SSE Response Stream:**

```
data: {"type":"thinking","tool":"search_codebase","query":"authentication middleware"}

data: {"type":"thinking","tool":"read_file","filePath":"src/auth/auth.guard.ts"}

data: {"type":"token","content":"The authentication issue"}

data: {"type":"token","content":" stems from line 42 in"}

data: {"type":"citation","filePath":"src/auth/auth.guard.ts","startLine":38,"endLine":55,"score":0.92}

data: {"type":"suggestion","diff":"--- a/src/auth/auth.guard.ts\n+++ ...","summary":"Fix null check"}

data: {"type":"done","tokensUsed":1240}

data: [DONE]
```

---

### `GET /api/sessions/:id`

**Response:**

```json
{
  "id": "sess_abc123",
  "repoName": "my-ecommerce-app",
  "repoUrl": "https://github.com/user/my-ecommerce-app",
  "createdAt": "2025-01-15T10:30:00Z",
  "status": "ready",
  "fileCount": 87,
  "chunkCount": 412,
  "fileTree": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        { "name": "app.module.ts", "type": "file", "path": "src/app.module.ts" }
      ]
    }
  ]
}
```

---

## 9. Environment Variables

### Backend `.env`

```bash
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# Claude API (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# OpenAI (Embeddings only)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=codebase-assistant

# E2B (Code Sandbox)
E2B_API_KEY=...

# Storage
SESSION_STORE_PATH=./data/sessions.json
TEMP_CLONE_DIR=./tmp/repos

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_REPO_SIZE_MB=50
MAX_CONCURRENT_INGESTIONS=3
```

### Frontend `environment.ts`

```typescript
export const environment = {
  production: false,
  apiBaseUrl: "http://localhost:3000/api",
};
```

---

## 10. Build Phases & Milestones

### Phase 1 — Foundation

**Backend:**

- [ ] Express app setup with TypeScript
- [ ] Environment config with Zod validation
- [ ] Session management service
- [ ] Basic file upload endpoint (Multer)
- [ ] Git clone + ZIP extract service
- [ ] File filter utility

**Frontend:**

- [ ] Angular 19 project setup + Tailwind
- [ ] Layout components (header, sidebar)
- [ ] Upload component (URL input + drag-drop)
- [ ] Session list component
- [ ] Routing setup

**Milestone:** Can upload a repo and see the file list in the UI.

---

### Phase 2 — Ingestion Pipeline

**Backend:**

- [ ] Chunker with sliding window + smart split points
- [ ] OpenAI embedding integration
- [ ] Pinecone namespace setup + upsert
- [ ] Ingestion status polling endpoint
- [ ] Progress tracking (EventEmitter-based)

**Frontend:**

- [ ] Ingestion progress UI with step indicators
- [ ] File tree component (recursive)
- [ ] Session status polling

**Milestone:** Can ingest a real GitHub repo and query Pinecone to verify vectors.

---

### Phase 3 — RAG & Basic Chat

**Backend:**

- [ ] Pinecone query service with threshold filtering
- [ ] Basic chat endpoint (non-streaming, no agent)
- [ ] Claude API integration
- [ ] Context assembly (retrieved chunks → prompt)

**Frontend:**

- [ ] Chat panel with message list
- [ ] Message input bar
- [ ] Basic message rendering (markdown)
- [ ] Citation display below messages

**Milestone:** Can ask "What does this file do?" and get a grounded answer with citations.

---

### Phase 4 — Agent & Tool Use

**Backend:**

- [ ] LangChain.js agent setup (ReAct)
- [ ] `search_codebase` tool
- [ ] `read_file` tool
- [ ] `run_code` tool (E2B integration)
- [ ] `write_suggestion` tool (diff generation)
- [ ] SSE streaming of agent thoughts + tokens

**Frontend:**

- [ ] SSE stream handler in Angular
- [ ] "Thinking" indicator (tool use steps)
- [ ] Token-by-token streaming render
- [ ] Diff viewer component

**Milestone:** Agent can autonomously multi-step reason: find auth files → read them → suggest a fix → show diff.

---

### Phase 5 — Polish & Production Readiness

**Backend:**

- [ ] Rate limiting (express-rate-limit)
- [ ] Input validation (Zod schemas on all endpoints)
- [ ] Error handling middleware
- [ ] Session cleanup (delete namespace on expiry)
- [ ] Request logging (Morgan)
- [ ] Health check endpoint

**Frontend:**

- [ ] Error toast notifications
- [ ] Loading skeletons
- [ ] Keyboard shortcuts (Enter to send, Esc to cancel)
- [ ] Mobile responsive layout
- [ ] Dark mode support
- [ ] Copy code button on code blocks

**Milestone:** Production-deployable app, error-safe, accessible on mobile.

---

## 11. Error Handling Strategy

### Backend Error Types

```typescript
// types/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class IngestionError extends AppError {
  constructor(message: string) {
    super(422, "INGESTION_FAILED", message);
  }
}

export class AgentError extends AppError {
  constructor(message: string) {
    super(500, "AGENT_ERROR", message);
  }
}

export class SessionNotFoundError extends AppError {
  constructor(id: string) {
    super(404, "SESSION_NOT_FOUND", `Session ${id} not found`);
  }
}
```

### Global Error Middleware

```typescript
// middleware/error.middleware.ts
app.use((err: Error, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }
  // Unexpected errors
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
});
```

### Frontend Error Interceptor

```typescript
// interceptors/error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 404) {
        // Navigate to upload
      } else if (err.status >= 500) {
        // Show toast: "Server error, please try again"
      }
      return throwError(() => err);
    }),
  );
};
```

---

## 12. Security Considerations

| Concern                       | Mitigation                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| Arbitrary code execution      | All code runs in E2B sandboxes, never on host                       |
| Path traversal in `read_file` | Validate paths against session's file tree                          |
| Large repo DoS                | Enforce `MAX_REPO_SIZE_MB` and `MAX_TOTAL_FILES`                    |
| API key exposure              | Keys only on backend, never in frontend bundle                      |
| CORS                          | Restrict to `FRONTEND_URL` only                                     |
| Rate limiting                 | 100 req/15 min per IP (configurable)                                |
| SSE connection abuse          | Max 1 concurrent stream per session                                 |
| Prompt injection              | Sanitize user input before inserting into prompts                   |
| Session isolation             | Pinecone namespaces ensure cross-session data leakage is impossible |

---

## 13. Performance Optimizations

### Ingestion

- **Batch embeddings:** Send 100 chunks per OpenAI API call instead of one-by-one
- **Batch upserts:** Send 100 vectors per Pinecone upsert call
- **Parallel processing:** Use `Promise.all` for independent file embeddings (respect rate limits)
- **Caching:** Skip re-embedding if file hash matches a cached embedding (future enhancement)

### RAG Quality

- **Score threshold:** Only return chunks with cosine similarity > 0.75
- **Context deduplication:** Remove duplicate file paths from top-K results
- **Hybrid retrieval (future):** Combine vector search with keyword BM25 for better precision on exact identifiers

### Frontend

- **Virtual scrolling** on file tree for large repos (CDK Virtual Scroll)
- **OnPush change detection** on all components
- **Lazy loaded routes** for upload and chat features
- **Deferrable views** for non-critical panels (diff viewer, citations)

---

## 14. Deployment Guide

### Local Development

```bash
# Clone the repo
git clone https://github.com/you/codebase-assistant

# Backend
cd backend
cp .env.example .env   # Fill in API keys
npm install
npm run dev            # ts-node-dev, hot reload

# Frontend (separate terminal)
cd frontend
npm install
ng serve               # http://localhost:4200
```

### Production (Free Tier)

| Service    | Platform   | Free Tier                              |
| ---------- | ---------- | -------------------------------------- |
| Backend    | Render.com | 512MB RAM, spins down after inactivity |
| Frontend   | Vercel     | Unlimited static hosting               |
| Vector DB  | Pinecone   | 1 index, 100K vectors                  |
| Embeddings | OpenAI     | Pay-per-use (very cheap at this scale) |
| LLM        | Anthropic  | Pay-per-use Claude API                 |
| Sandbox    | E2B        | Free tier with generous limits         |

### Backend Deployment (Render)

```yaml
# render.yaml
services:
  - type: web
    name: codebase-assistant-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: ANTHROPIC_API_KEY
        sync: false # Set in Render dashboard
```

### Frontend Deployment (Vercel)

```json
// vercel.json
{
  "buildCommand": "ng build --configuration=production",
  "outputDirectory": "dist/frontend/browser",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Appendix: Tech Versions (Pinned)

| Package                       | Version |
| ----------------------------- | ------- |
| Node.js                       | 20 LTS  |
| Angular                       | 19.x    |
| TypeScript                    | 5.4+    |
| LangChain.js                  | 0.3.x   |
| `@pinecone-database/pinecone` | 3.x     |
| `openai`                      | 4.x     |
| `@anthropic-ai/sdk`           | 0.30.x  |
| `e2b`                         | 1.x     |
| `express`                     | 4.x     |
| `multer`                      | 1.x     |
| `simple-git`                  | 3.x     |
| Tailwind CSS                  | 3.x     |

---

_Generated for portfolio project — AI-Powered Codebase Assistant_  
_Stack: Angular 19 · Node/Express · LangChain.js · Pinecone · OpenAI · Claude API · E2B_
