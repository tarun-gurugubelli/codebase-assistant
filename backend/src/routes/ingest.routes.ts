import { Router } from 'express';
import { ingestController } from '../controllers/ingest.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

router.post('/url', (req, res, next) =>
  ingestController.fromUrl(req, res).catch(next));

router.post('/upload', uploadMiddleware.single('file'), (req, res, next) =>
  ingestController.fromUpload(req, res).catch(next));

router.get('/:sessionId/status', (req, res, next) =>
  ingestController.getStatus(req, res).catch(next));

export default router;
