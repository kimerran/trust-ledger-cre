import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { decisions, auditEvents, workflowRuns } from '../../db/schema';
import { internalAuthGuard } from '../middleware/authGuard';
import { anchorDecisionOnChain } from '../services/anchorService';

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
  anchoredAt: z.string(),
});

// ─── POST /webhooks/cre ───────────────────────────────────────────────────────

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

  const { decisionId, workflowRunId, hash, signature, riskAssessment, anchoredAt } =
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

    // Anchor the decision on-chain (Sepolia)
    const riskJson = JSON.stringify(riskAssessment);
    let txHash: string;
    let blockNumber: number;

    try {
      const anchorResult = await anchorDecisionOnChain({
        decisionId,
        inputHash: hash,
        signature,
        riskJson,
      });
      txHash = anchorResult.txHash;
      blockNumber = anchorResult.blockNumber;
    } catch (anchorErr) {
      log.error({ err: anchorErr, decisionId }, 'On-chain anchoring failed');

      await db
        .update(decisions)
        .set({
          riskLevel: riskAssessment.riskLevel,
          riskSummary: riskAssessment.summary,
          status: 'FAILED',
          errorMessage: 'On-chain anchoring failed',
          updatedAt: new Date(),
        })
        .where(eq(decisions.id, decisionId));

      await db.insert(auditEvents).values({
        tenantId,
        decisionId,
        eventType: 'DECISION_FAILED',
        payload: { decisionId, reason: 'On-chain anchoring failed' },
      });

      res.status(500).json({
        success: false,
        error: { code: 'ANCHOR_FAILED', message: 'On-chain anchoring failed' },
      });
      return;
    }

    // Update decision to ANCHORED
    await db
      .update(decisions)
      .set({
        signature,
        riskLevel: riskAssessment.riskLevel,
        riskSummary: riskAssessment.summary,
        txHash,
        blockNumber,
        status: 'ANCHORED',
        updatedAt: new Date(),
      })
      .where(eq(decisions.id, decisionId));

    // Record audit event
    await db.insert(auditEvents).values({
      tenantId,
      decisionId,
      eventType: 'DECISION_ANCHORED',
      payload: { decisionId, txHash, blockNumber, anchoredAt },
    });

    // Update workflow run
    await db
      .update(workflowRuns)
      .set({
        status: 'SUCCESS',
        output: { txHash, blockNumber, riskAssessment },
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
      { decisionId, txHash, blockNumber, riskLevel: riskAssessment.riskLevel },
      'Decision anchored via CRE callback',
    );

    res.json({ success: true, data: { decisionId, status: 'ANCHORED', txHash, blockNumber } });
  } catch (err) {
    log.error({ err, decisionId }, 'CRE webhook processing failed');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process CRE callback' },
    });
  }
});

export default router;
