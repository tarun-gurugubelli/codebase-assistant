import OpenAI from 'openai';
import { env } from '../config/env';
import { RetrievedChunk } from './retrieval.service';
import { streamService } from './stream.service';
import { getTools, handleToolCall } from './tools.service';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const MAX_ITERATIONS = 8;

const AGENT_SYSTEM_PROMPT = `You are an expert software engineering assistant.
You have tools to search the codebase, read full files, run code snippets, and suggest code changes.
Always call search_codebase before answering — never guess from memory.
Use read_file when you need the full context of a file found via search.
Use write_suggestion when the user asks for a fix, refactor, or optimisation.
Use run_code to verify hypotheses or reproduce bugs.
In your final answer, cite specific file paths and line numbers inline (e.g. \`src/auth/middleware.ts:42\`).
Be concise and precise.`;

export interface AgentStep {
  tool: string;
  [key: string]: unknown;
}

export interface AgentSuggestion {
  filePath: string;
  diff: string;
  summary: string;
}

export interface AgentResult {
  answer: string;
  citations: RetrievedChunk[];
  suggestions: AgentSuggestion[];
  steps: AgentStep[];
  tokensUsed: number;
}

// ─── Shared tool-use loop ─────────────────────────────────────────────────────

async function runToolLoop(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  sessionId: string,
  streamId?: string,
): Promise<{ allCitations: RetrievedChunk[]; allSuggestions: AgentSuggestion[]; steps: AgentStep[]; totalTokens: number; finalAnswer: string }> {
  const allCitations: RetrievedChunk[] = [];
  const allSuggestions: AgentSuggestion[] = [];
  const steps: AgentStep[] = [];
  let totalTokens = 0;
  let finalAnswer = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: env.CHAT_MODEL,
      messages,
      tools: getTools(),
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    totalTokens += response.usage?.total_tokens ?? 0;

    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      finalAnswer = choice.message.content ?? '';
      break;
    }

    messages.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      const result = await handleToolCall(toolCall, sessionId, streamId);

      // Accumulate citations (deduplicated)
      if (result.newCitations) {
        for (const chunk of result.newCitations) {
          if (!allCitations.some(c => c.id === chunk.id)) {
            allCitations.push(chunk);
            // Emit citation SSE only for streaming calls
            streamId && streamService.push(streamId, {
              type: 'citation',
              filePath: chunk.filePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              score: Math.round(chunk.score * 1000) / 1000,
            });
          }
        }
      }

      if (result.suggestion) allSuggestions.push(result.suggestion);

      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      steps.push({ tool: toolCall.function.name, ...args });

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.toolContent });
    }
  }

  return { allCitations, allSuggestions, steps, totalTokens, finalAnswer };
}

// ─── Non-streaming agent ──────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  sessionId: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AgentResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const { allCitations, allSuggestions, steps, totalTokens, finalAnswer } = await runToolLoop(messages, sessionId);

  return {
    answer: finalAnswer,
    citations: allCitations,
    suggestions: allSuggestions,
    steps,
    tokensUsed: totalTokens,
  };
}

// ─── Streaming agent ──────────────────────────────────────────────────────────

export async function runAgentStreaming(
  userMessage: string,
  sessionId: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  streamId: string,
): Promise<AgentResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const { allCitations, allSuggestions, steps, totalTokens } =
    await runToolLoop(messages, sessionId, streamId);

  // Stream final answer token-by-token
  const stream = await openai.chat.completions.create({
    model: env.CHAT_MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });

  let answer = '';
  let streamTokens = 0;

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) {
      answer += token;
      streamService.push(streamId, { type: 'token', content: token });
    }
    if (chunk.usage) streamTokens = chunk.usage.total_tokens;
  }

  const finalTokensUsed = totalTokens + streamTokens;
  streamService.push(streamId, { type: 'done', tokensUsed: finalTokensUsed });
  streamService.end(streamId);

  return { answer, citations: allCitations, suggestions: allSuggestions, steps, tokensUsed: finalTokensUsed };
}
