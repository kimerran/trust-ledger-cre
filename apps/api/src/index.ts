import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import pino from 'pino';

import healthRouter from './routes/health';
import decisionsRouter from './routes/decisions';
import modelsRouter from './routes/models';
import workflowRunsRouter from './routes/workflowRuns';
import eventsRouter from './routes/events';
import webhooksRouter from './routes/webhooks';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is required');

const log = pino({
  name: 'trustledger-api',
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  log.debug({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/decisions', decisionsRouter);
app.use('/models', modelsRouter);
app.use('/workflow-runs', workflowRunsRouter);
app.use('/events', eventsRouter);
app.use('/webhooks', webhooksRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log.info({ port: PORT, env: process.env.NODE_ENV }, 'TrustLedger API running');
});

export default app;
