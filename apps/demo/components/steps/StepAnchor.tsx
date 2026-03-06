'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeBlock } from '@/components/CodeBlock';
import { UnderTheHood } from '@/components/UnderTheHood';

interface StepAnchorProps {
  decisionId: string;
  inputHash: string;
  signature: string;
  decisionPayload: string;
  onNext: () => void;
}

export function StepAnchor({ decisionId, inputHash, signature, decisionPayload, onNext }: StepAnchorProps) {
  // Parse the submitted payload to extract decision fields
  let decision = { type: 'loan_approval', outcome: 'APPROVED', confidence: 0.92, topFeatures: [] as Array<{ name: string; value: number; contribution: number }> };
  try {
    const parsed = JSON.parse(decisionPayload);
    decision = {
      type: parsed.decisionType ?? decision.type,
      outcome: parsed.outcome ?? decision.outcome,
      confidence: parsed.confidence ?? decision.confidence,
      topFeatures: parsed.topFeatures ?? decision.topFeatures,
    };
  } catch { /* use defaults */ }

  const payloadObj = {
    decisionId,
    signature,
    modelId: '00000000-0000-0000-0000-000000000001',
    inputHash,
    callbackUrl: 'http://localhost:3001/webhooks/cre',
    decision,
    secrets: {
      ANTHROPIC_API_KEY: '__ANTHROPIC_API_KEY__',
      INTERNAL_API_KEY: '__INTERNAL_API_KEY__',
    },
  };

  // Build JSON with shell variable references (unquoted $VAR for shell expansion)
  const httpPayload = JSON.stringify(payloadObj, null, 4)
    .replace('"__ANTHROPIC_API_KEY__"', '"$ANTHROPIC_API_KEY"')
    .replace('"__INTERNAL_API_KEY__"', '"$INTERNAL_API_KEY"');

  // Use double-quoted --http-payload so shell expands $ANTHROPIC_API_KEY and $INTERNAL_API_KEY
  // Escape inner double quotes with backslash
  const escapedPayload = httpPayload.replace(/"/g, '\\"');

  const sampleCommand = `cre workflow simulate ./chainlink/workflows/trustledger-risk-monitor \\
  --broadcast \\
  -R . \\
  --target dev-settings \\
  --trigger-index 0 \\
  --non-interactive \\
  --http-payload "${escapedPayload}"`;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Blockchain Anchor</CardTitle>
        <CardDescription>
          The Chainlink CRE workflow hashes the decision, signs it with KMS, runs an LLM risk
          assessment, and anchors the proof on-chain via{' '}
          <code className="text-xs bg-muted px-1 rounded">EVMClient.writeReport</code> to the
          AuditAnchor contract on Sepolia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-md bg-muted/50 text-sm space-y-3">
          <p className="font-medium">CRE Workflow Pipeline:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Canonicalize payload (RFC 8785) and verify hash</li>
            <li>Sign with AWS KMS (<code className="text-xs">ECDSA_SHA_256</code>)</li>
            <li>Risk assessment via Claude Haiku</li>
            <li>Anchor on-chain via <code className="text-xs">EVMClient.writeReport</code></li>
            <li>Callback to backend with txHash</li>
          </ol>
        </div>

        <UnderTheHood defaultOpen>
          <CodeBlock title="CRE Simulate Command" language="bash" copyButton>
            {sampleCommand}
          </CodeBlock>
        </UnderTheHood>

        <div className="flex justify-end pt-2">
          <Button onClick={onNext}>Next: Verify</Button>
        </div>
      </CardContent>
    </Card>
  );
}
