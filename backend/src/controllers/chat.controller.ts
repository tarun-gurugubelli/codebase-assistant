import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sessionService } from '../services/session.service';
import { streamService } from '../services/stream.service';
import { runAgentStreaming } from '../services/agent.service';
import { initSSE } from '../utils/streamHelper';
import { ValidationError } from '../types/errors';

export const chatController = {
  // POST /api/chat/:sessionId/message
  // Validates, creates a stream, kicks off the agent, returns { streamId }.
  // Client then opens GET /api/chat/:sessionId/stream/:streamId for SSE events.
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const { message } = req.body as { message?: string };

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ValidationError('message is required');
    }

    const session = sessionService.get(sessionId);
    if (!session) {
      res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` } });
      return;
    }
    if (session.status !== 'ready') {
      res.status(400).json({ error: { code: 'SESSION_NOT_READY', message: `Session is still ${session.status}` } });
      return;
    }

    const streamId = uuidv4();
    streamService.create(streamId);

    res.json({ streamId });

    // Fire-and-forget — response already sent
    const history = sessionService.getMessages(sessionId).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    runAgentStreaming(message.trim(), sessionId, history, streamId)
      .then(result => {
        const citations = result.citations.map(c => ({
          filePath: c.filePath,
          startLine: c.startLine,
          endLine: c.endLine,
          score: c.score,
          chunkText: c.chunkText,
        }));
        sessionService.addMessage(uuidv4(), sessionId, 'user', message.trim());
        sessionService.addMessage(uuidv4(), sessionId, 'assistant', result.answer, [
          ...citations,
          ...result.suggestions.map(s => ({ type: 'suggestion', filePath: s.filePath, summary: s.summary })),
        ]);
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        streamService.push(streamId, { type: 'error', error: msg });
        streamService.end(streamId);
      });
  },

  // GET /api/chat/:sessionId/stream/:streamId
  // Opens the SSE connection for an in-progress agent run.
  async openStream(req: Request, res: Response): Promise<void> {
    const { streamId } = req.params;

    initSSE(res);

    const connected = streamService.connect(streamId, res);
    if (!connected) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream not found or expired' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  },

  async getHistory(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    if (!sessionService.get(sessionId)) {
      res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` } });
      return;
    }
    res.json({ messages: sessionService.getMessages(sessionId) });
  },

  async clearHistory(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    if (!sessionService.get(sessionId)) {
      res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` } });
      return;
    }
    sessionService.clearMessages(sessionId);
    res.status(204).send();
  },
};
