import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, INTERNAL_API_KEY } from '@/lib/constants';
import type { CREWebhookPayload } from '@trustledger/shared';

export async function POST(req: NextRequest) {
  const { decisionId, inputHash, signature } = await req.json();

  if (!decisionId || !inputHash || !signature) {
    return NextResponse.json(
      { error: 'Missing decisionId, inputHash, or signature' },
      { status: 400 },
    );
  }

  // Construct a realistic CRE webhook payload
  const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const fakeBlockNumber = 6_000_000 + Math.floor(Math.random() * 100_000);

  const payload: CREWebhookPayload = {
    decisionId,
    workflowRunId: crypto.randomUUID(),
    hash: inputHash,
    signature,
    riskAssessment: {
      riskLevel: 'LOW',
      summary: 'Automated risk assessment: loan approval with high credit score (780) and low debt-to-income ratio (0.22). Model confidence 92%. No anomalies detected.',
    },
    txHash: fakeTxHash,
    blockNumber: fakeBlockNumber,
    anchoredAt: new Date().toISOString(),
  };

  const res = await fetch(`${API_BASE_URL}/webhooks/cre`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': INTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({ ...data, simulatedPayload: payload });
}
