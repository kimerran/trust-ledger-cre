import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';

const router = Router();

router.get('/', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
