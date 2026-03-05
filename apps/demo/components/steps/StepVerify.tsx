'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerificationLayerCard } from '@/components/VerificationLayerCard';
import { UnderTheHood } from '@/components/UnderTheHood';
import { CodeBlock } from '@/components/CodeBlock';
import type { VerificationResult } from '@trustledger/shared';

interface StepVerifyProps {
  decisionId: string;
  verification: VerificationResult | null;
  onVerify: () => void;
  onNext: () => void;
  isLoading: boolean;
}

const overallVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  PASS: 'success',
  PARTIAL: 'warning',
  FAIL: 'destructive',
};

export function StepVerify({ decisionId, verification, onVerify, onNext, isLoading }: StepVerifyProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Three-Layer Verification</CardTitle>
        <CardDescription>
          Independently verify the decision&apos;s integrity through three layers: hash recompute,
          KMS signature verification, and on-chain anchor lookup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!verification ? (
          <>
            <div className="p-4 rounded-md bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Three verification layers:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li><strong>Hash Match</strong> — Recompute canonical hash from input features and compare</li>
                <li><strong>Signature Valid</strong> — Verify KMS ECDSA signature against stored hash</li>
                <li><strong>On-Chain Anchor</strong> — Query Etherscan for the anchored tx hash</li>
              </ol>
            </div>
            <Button onClick={onVerify} disabled={isLoading}>
              {isLoading ? 'Verifying...' : `GET /decisions/${decisionId}/verify`}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-muted-foreground">Overall:</span>
              <Badge variant={overallVariant[verification.overall] ?? 'destructive'}>
                {verification.overall}
              </Badge>
            </div>

            {verification.overall === 'PARTIAL' && (
              <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                Layer 3 (on-chain) shows FAIL because the simulated tx hash doesn&apos;t exist on
                Etherscan Sepolia. In production with real CRE anchoring, all three layers pass.
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <VerificationLayerCard
                title="Layer 1: Hash Match"
                pass={verification.layers.hashMatch.pass}
                details={{
                  computed: verification.layers.hashMatch.computed,
                  stored: verification.layers.hashMatch.stored,
                }}
              />
              <VerificationLayerCard
                title="Layer 2: Signature Valid"
                pass={verification.layers.signatureValid.pass}
                details={{
                  algorithm: verification.layers.signatureValid.algorithm,
                  kmsKeyArn: verification.layers.signatureValid.kmsKeyArn,
                }}
              />
              <VerificationLayerCard
                title="Layer 3: On-Chain Anchor"
                pass={verification.layers.onchainAnchor.pass}
                details={{
                  txHash: verification.layers.onchainAnchor.txHash,
                  blockNumber: verification.layers.onchainAnchor.blockNumber,
                  chain: verification.layers.onchainAnchor.chain,
                }}
              />
            </div>

            <UnderTheHood>
              <CodeBlock title={`GET /decisions/${decisionId}/verify — Response`}>
                {JSON.stringify({ success: true, data: verification }, null, 2)}
              </CodeBlock>
            </UnderTheHood>

            <div className="flex justify-end pt-2">
              <Button onClick={onNext}>Next: Proof &amp; Summary</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
