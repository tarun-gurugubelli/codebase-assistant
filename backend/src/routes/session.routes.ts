import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';

const router = Router();

router.get('/', (req, res, next) =>
  sessionController.list(req, res).catch(next));

router.get('/:id', (req, res, next) =>
  sessionController.get(req, res).catch(next));

router.delete('/:id', (req, res, next) =>
  sessionController.delete(req, res).catch(next));

export default router;
