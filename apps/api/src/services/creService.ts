import pino from 'pino';

const log = pino({ name: 'cre-service' });

interface CRETriggerPayload {
  decisionId: string;
  decision: {
    type: string;
    outcome: string;
    confidence: number;
    topFeatures: Array<{ name: string; value: unknown; contribution: number }>;
  };
  inputHash: string;
  callbackUrl: string;
}

interface CRETriggerResult {
  workflowRunId: string;
  status: 'ACCEPTED';
}

/**
 * Triggers the Chainlink CRE trustledger-risk-monitor workflow.
 * The CRE node will asynchronously sign, assess risk, anchor on-chain,
 * and then POST the result back to our /webhooks/cre endpoint.
 */
export async function triggerRiskMonitorWorkflow(
  payload: CRETriggerPayload,
): Promise<CRETriggerResult> {
  const creNodeUrl = process.env.CRE_NODE_URL;
  const creApiKey = process.env.CRE_API_KEY;

  if (!creNodeUrl || !creApiKey) {
    // In dev, simulate CRE acceptance and log for manual verification
    log.warn(
      { decisionId: payload.decisionId },
      'CRE_NODE_URL or CRE_API_KEY not set — workflow trigger simulated',
    );
    return {
      workflowRunId: `simulated-${payload.decisionId}`,
      status: 'ACCEPTED',
    };
  }

  const url = `${creNodeUrl}/workflows/trustledger-risk-monitor/trigger`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CRE-Api-Key': creApiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`CRE trigger failed: HTTP ${resp.status} — ${body}`);
  }

  const result = (await resp.json()) as CRETriggerResult;
  log.info(
    { decisionId: payload.decisionId, workflowRunId: result.workflowRunId },
    'CRE workflow triggered',
  );
  return result;
}
