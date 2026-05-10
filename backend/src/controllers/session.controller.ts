import { Request, Response } from 'express';
import { sessionService } from '../services/session.service';
import { pineconeService } from '../services/pinecone.service';

export const sessionController = {
  async list(_req: Request, res: Response): Promise<void> {
    const sessions = sessionService.list();
    res.json({ sessions });
  },

  async get(req: Request, res: Response): Promise<void> {
    const session = sessionService.get(req.params.id);
    if (!session) {
      res.status(404).json({
        error: { code: 'SESSION_NOT_FOUND', message: `Session ${req.params.id} not found` },
      });
      return;
    }
    res.json(session);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const session = sessionService.get(id);
    if (!session) {
      res.status(404).json({
        error: { code: 'SESSION_NOT_FOUND', message: `Session ${id} not found` },
      });
      return;
    }

    await pineconeService.deleteNamespace(id);
    sessionService.delete(id);
    res.status(204).send();
  },
};
