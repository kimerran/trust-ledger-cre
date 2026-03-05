import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { workflowRuns } from '../../db/schema';
import { tenantGuard } from '../middleware/tenantGuard';

const router = Router();
const log = pino({ name: 'workflow-runs-route' });

// ─── GET /workflow-runs ───────────────────────────────────────────────────────

router.get('/', tenantGuard, async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const runs = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.tenantId, tenantId))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(100);

    res.json({ success: true, data: runs });
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to list workflow runs');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workflow runs' },
    });
  }
});

// ─── GET /workflow-runs/:id ───────────────────────────────────────────────────

router.get('/:id', tenantGuard, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  try {
    const [run] = await db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.id, id), eq(workflowRuns.tenantId, tenantId)))
      .limit(1);

    if (!run) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow run not found' },
      });
      return;
    }

    res.json({ success: true, data: run });
  } catch (err) {
    log.error({ err, id, tenantId }, 'Failed to get workflow run');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workflow run' },
    });
  }
});

export default router;
