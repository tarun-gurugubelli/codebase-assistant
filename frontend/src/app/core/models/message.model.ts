export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  score?: number;
  chunkText?: string;
}

export interface Suggestion {
  type: 'suggestion';
  filePath: string;
  summary: string;
  diff?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  suggestions?: Suggestion[];
  createdAt?: string;
}

export type SSEEventType =
  | 'thinking'
  | 'citation'
  | 'token'
  | 'done'
  | 'suggestion'
  | 'code_result'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  // thinking
  tool?: string;
  query?: string;
  filePath?: string;
  resultCount?: number;
  // citation
  startLine?: number;
  endLine?: number;
  score?: number;
  // token
  content?: string;
  // done
  tokensUsed?: number;
  // suggestion
  diff?: string;
  summary?: string;
  // code_result
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  // error
  error?: string;
}
