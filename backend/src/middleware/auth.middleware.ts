import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// Only enforced when API_KEY env var is set.
// Clients must send: X-API-Key: <value>
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.API_KEY) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'];
  if (provided !== env.API_KEY) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } });
    return;
  }

  next();
}
