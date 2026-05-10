import { createApp } from './app';
import { env } from './config/env';
import { startCleanupJob } from './services/cleanup.service';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[server] Listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);

  startCleanupJob();

  // Prevent Render free tier from spinning down: ping /health every 10 minutes.
  if (env.NODE_ENV === 'production') {
    const selfUrl = `http://localhost:${env.PORT}/health`;
    setInterval(() => {
      fetch(selfUrl).catch(() => { /* ignore — server may be briefly busy */ });
    }, 10 * 60 * 1000);
    console.log('[keepalive] Self-ping enabled');
  }
});
