import vm from 'vm';
import ts from 'typescript';
import { createPatch } from 'diff';
import OpenAI from 'openai';
import { sessionService } from './session.service';
import { retrieveRelevantChunks, RetrievedChunk } from './retrieval.service';
import { streamService } from './stream.service';

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_codebase',
      description:
        'Semantically search the codebase for relevant code snippets. ' +
        'Use to find implementations, understand patterns, or locate specific functionality. ' +
        'Call multiple times with different queries for comprehensive coverage.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language description of the code you are looking for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the complete contents of a specific file in the repository. ' +
        'Use when you need full file context beyond the snippets returned by search_codebase.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path relative to repo root (e.g. src/auth/middleware.ts)' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_suggestion',
      description:
        'Generate a code improvement as a unified diff patch. ' +
        'Use when the user asks for a refactor, bug fix, or optimisation.',
      parameters: {
        type: 'object',
        properties: {
          filePath:     { type: 'string', description: 'File being modified' },
          originalCode: { type: 'string', description: 'The original code (exact, as it exists in the file)' },
          improvedCode: { type: 'string', description: 'The improved version of the code' },
          reason:       { type: 'string', description: 'Why this change improves the code' },
        },
        required: ['filePath', 'originalCode', 'improvedCode', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description:
        'Execute a JavaScript or TypeScript snippet in an isolated sandbox to verify behaviour, ' +
        'test a hypothesis, or reproduce a bug. Only console.log output is captured.',
      parameters: {
        type: 'object',
        properties: {
          code:     { type: 'string', description: 'The code to execute' },
          language: { type: 'string', enum: ['javascript', 'typescript'], description: 'Language of the snippet' },
        },
        required: ['code', 'language'],
      },
    },
  },
];

// ─── Return shape from each handler ──────────────────────────────────────────

export interface ToolHandleResult {
  toolContent: string;            // JSON string fed back to the model as the tool result
  newCitations?: RetrievedChunk[];
  suggestion?: { filePath: string; diff: string; summary: string };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleSearchCodebase(
  args: { query: string },
  sessionId: string,
  streamId?: string,
): Promise<ToolHandleResult> {
  const chunks = await retrieveRelevantChunks(args.query, sessionId);

  streamId && streamService.push(streamId, {
    type: 'thinking', tool: 'search_codebase', query: args.query, resultCount: chunks.length,
  });

  return {
    toolContent: JSON.stringify(chunks.map(c => ({
      filePath: c.filePath, startLine: c.startLine, endLine: c.endLine,
      language: c.language, score: Math.round(c.score * 1000) / 1000, code: c.chunkText,
    }))),
    newCitations: chunks,
  };
}

async function handleReadFile(
  args: { filePath: string },
  sessionId: string,
  streamId?: string,
): Promise<ToolHandleResult> {
  streamId && streamService.push(streamId, { type: 'thinking', tool: 'read_file', filePath: args.filePath });

  const file = sessionService.getFile(sessionId, args.filePath);

  if (!file) {
    return { toolContent: JSON.stringify({ error: `File not found: ${args.filePath}` }) };
  }

  const lineCount = file.content.split('\n').length;
  return {
    toolContent: JSON.stringify({
      filePath: args.filePath,
      language: file.language,
      lineCount,
      content: file.content,
    }),
  };
}

function handleWriteSuggestion(
  args: { filePath: string; originalCode: string; improvedCode: string; reason: string },
  streamId?: string,
): ToolHandleResult {
  const diff = createPatch(
    args.filePath,
    args.originalCode,
    args.improvedCode,
    'original',
    'suggested',
  );

  const suggestion = { filePath: args.filePath, diff, summary: args.reason };

  streamId && streamService.push(streamId, { type: 'suggestion', ...suggestion });

  return {
    toolContent: JSON.stringify({ diff, summary: args.reason }),
    suggestion,
  };
}

// Runs JS/TS in a restricted vm sandbox (no fs, no network, no require).
// Timeout: 5 s. Only console output is captured.
function handleRunCode(
  args: { code: string; language: string },
  streamId?: string,
): ToolHandleResult {
  streamId && streamService.push(streamId, { type: 'thinking', tool: 'run_code', language: args.language });

  let jsCode = args.code;

  if (args.language === 'typescript') {
    const result = ts.transpileModule(args.code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    jsCode = result.outputText;
  }

  const logs: string[] = [];
  const sandbox = {
    console: {
      log:   (...a: unknown[]) => logs.push(a.map(String).join(' ')),
      error: (...a: unknown[]) => logs.push('[error] ' + a.map(String).join(' ')),
      warn:  (...a: unknown[]) => logs.push('[warn] '  + a.map(String).join(' ')),
    },
    Math, JSON, parseInt, parseFloat, isNaN, isFinite,
    String, Number, Boolean, Array, Object, Date, Error,
  };

  let stderr = '';
  let exitCode = 0;

  try {
    vm.runInNewContext(jsCode, sandbox, { timeout: 5000 });
  } catch (err: unknown) {
    stderr = err instanceof Error ? err.message : String(err);
    exitCode = 1;
  }

  const output = { stdout: logs.join('\n'), stderr, exitCode };
  streamId && streamService.push(streamId, { type: 'code_result', ...output });

  return { toolContent: JSON.stringify(output) };
}

// ─── Central dispatcher ───────────────────────────────────────────────────────

export async function handleToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  sessionId: string,
  streamId?: string,
): Promise<ToolHandleResult> {
  const args = JSON.parse(toolCall.function.arguments) as Record<string, string>;

  switch (toolCall.function.name) {
    case 'search_codebase':
      return handleSearchCodebase(args as { query: string }, sessionId, streamId);

    case 'read_file':
      return handleReadFile(args as { filePath: string }, sessionId, streamId);

    case 'write_suggestion':
      return handleWriteSuggestion(
        args as { filePath: string; originalCode: string; improvedCode: string; reason: string },
        streamId,
      );

    case 'run_code':
      return handleRunCode(args as { code: string; language: string }, streamId);

    default:
      return { toolContent: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }) };
  }
}
