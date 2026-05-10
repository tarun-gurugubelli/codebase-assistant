import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import ingestRoutes from './routes/ingest.routes';
import sessionRoutes from './routes/session.routes';
import chatRoutes from './routes/chat.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL }));
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api/', rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } },
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/ingest', ingestRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/chat', chatRoutes);

  app.use(errorMiddleware);

  return app;
}
