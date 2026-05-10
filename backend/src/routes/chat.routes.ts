import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

const router = Router();

router.post('/:sessionId/message', (req, res, next) =>
  chatController.sendMessage(req, res).catch(next));

router.get('/:sessionId/stream/:streamId', (req, res, next) =>
  chatController.openStream(req, res).catch(next));

router.get('/:sessionId/history', (req, res, next) =>
  chatController.getHistory(req, res).catch(next));

router.delete('/:sessionId/history', (req, res, next) =>
  chatController.clearHistory(req, res).catch(next));

export default router;
