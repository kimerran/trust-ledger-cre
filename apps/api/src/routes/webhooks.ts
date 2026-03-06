import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { decisions, auditEvents, workflowRuns } from '../../db/schema';
import { internalAuthGuard } from '../middleware/authGuard';
import { broadcastEvent } from './events';

const router = Router();
const log = pino({ name: 'webhooks-route' });

const creWebhookSchema = z.object({
  decisionId: z.string(),
  workflowRunId: z.string(),
  hash: z.string().startsWith('sha256:'),
  signature: z.string(),
  riskAssessment: z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    summary: z.string(),
  }),
  txHash: z.string().startsWith('0x'),
  anchoredAt: z.string(),
});

// ─── POST /webhooks/cre ───────────────────────────────────────────────────────
// The CRE DON has already anchored the decision on-chain. This callback just
// updates the database with the txHash and risk assessment results.

router.post('/cre', internalAuthGuard, async (req, res) => {
  const parsed = creWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    log.warn({ errors: parsed.error.flatten() }, 'CRE webhook payload invalid');
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
    });
    return;
  }

  const { decisionId, workflowRunId, hash, signature, riskAssessment, txHash, anchoredAt } =
    parsed.data;

  try {
    // Fetch the decision (no tenantId filter needed here — internal callback)
    const [decision] = await db
      .select()
      .from(decisions)
      .where(eq(decisions.id, decisionId))
      .limit(1);

    if (!decision) {
      log.error({ decisionId }, 'CRE webhook: decision not found');
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Decision not found' },
      });
      return;
    }

    const tenantId = decision.tenantId;

    // Update decision to ANCHORED (on-chain write already done by CRE DON)
    await db
      .update(decisions)
      .set({
        signature,
        riskLevel: riskAssessment.riskLevel,
        riskSummary: riskAssessment.summary,
        txHash,
        status: 'ANCHORED',
        updatedAt: new Date(),
      })
      .where(eq(decisions.id, decisionId));

    // Record audit event
    await db.insert(auditEvents).values({
      tenantId,
      decisionId,
      eventType: 'DECISION_ANCHORED',
      payload: { decisionId, txHash, anchoredAt },
    });
    broadcastEvent(tenantId, 'DECISION_ANCHORED', { decisionId, txHash });

    // Update workflow run
    await db
      .update(workflowRuns)
      .set({
        status: 'SUCCESS',
        output: { txHash, riskAssessment },
        completedAt: new Date(),
        durationMs: Math.round(
          (new Date(anchoredAt).getTime() - decision.createdAt.getTime()),
        ),
      })
      .where(
        and(
          eq(workflowRuns.id, workflowRunId),
          eq(workflowRuns.decisionId, decisionId),
        ),
      );

    log.info(
      { decisionId, txHash, riskLevel: riskAssessment.riskLevel },
      'Decision anchored by CRE DON — DB updated',
    );

    res.json({ success: true, data: { decisionId, status: 'ANCHORED', txHash } });
  } catch (err) {
    log.error({ err, decisionId }, 'CRE webhook processing failed');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process CRE callback' },
    });
  }
});

export default router;
