'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeBlock } from '@/components/CodeBlock';
import { StatusBadge } from '@/components/StatusBadge';
import { UnderTheHood } from '@/components/UnderTheHood';
import type { Decision } from '@trustledger/shared';

interface StepAnchorProps {
  decision: Decision;
  anchoredDecision: Decision | null;
  simulatedPayload: Record<string, unknown> | null;
  onAnchor: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function StepAnchor({
  decision,
  anchoredDecision,
  simulatedPayload,
  onAnchor,
  onNext,
  isLoading,
}: StepAnchorProps) {
  const current = anchoredDecision ?? decision;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: On-Chain Anchor</CardTitle>
        <CardDescription>
          In production, Chainlink CRE anchors the decision hash on-chain and calls back.
          Here we simulate the CRE webhook to move the decision to ANCHORED status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-md bg-muted/50 text-sm space-y-2">
          <p className="font-medium">What happens in production:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>CRE workflow reads the decision hash + signature</li>
            <li>Risk assessment is computed (model confidence, anomaly detection)</li>
            <li>Hash is written to the AuditAnchor smart contract on Sepolia</li>
            <li>CRE calls back <code className="text-xs bg-muted px-1 rounded">POST /webhooks/cre</code> with tx details</li>
          </ol>
        </div>

        {!anchoredDecision ? (
          <Button onClick={onAnchor} disabled={isLoading}>
            {isLoading ? 'Anchoring...' : 'Simulate CRE Anchor'}
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={current.status} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <span className="text-xs text-muted-foreground">Risk Level</span>
                <p className="font-mono text-sm">{current.riskLevel ?? 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Risk Summary</span>
                <p className="text-sm">{current.riskSummary ?? 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Transaction Hash</span>
                <p className="font-mono text-xs break-all">{current.txHash ?? 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Block Number</span>
                <p className="font-mono text-sm">{current.blockNumber ?? 'N/A'}</p>
              </div>
            </div>

            <UnderTheHood>
              <CodeBlock title="Simulated CRE Webhook Payload">
                {JSON.stringify(simulatedPayload, null, 2)}
              </CodeBlock>
            </UnderTheHood>

            <div className="flex justify-end pt-2">
              <Button onClick={onNext}>Next: Verify</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
