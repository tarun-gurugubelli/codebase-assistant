export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  chunkText?: string;
}

export type SSEEventType = 'thinking' | 'token' | 'citation' | 'suggestion' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  tool?: string;
  query?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  score?: number;
  diff?: string;
  summary?: string;
  tokensUsed?: number;
  error?: string;
}
