'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeBlock } from '@/components/CodeBlock';
import { StatusBadge } from '@/components/StatusBadge';
import { UnderTheHood } from '@/components/UnderTheHood';
import type { Decision } from '@trustledger/shared';

interface StepSubmitProps {
  token: string;
  decision: Decision | null;
  editedJson: string;
  onEditJson: (json: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function StepSubmit({ token, decision, editedJson, onEditJson, onSubmit, onNext, isLoading }: StepSubmitProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Submit AI Decision</CardTitle>
        <CardDescription>
          Send an AI model&apos;s decision to the TrustLedger API. The API computes a canonical hash
          (RFC 8785 JSON) and signs it with KMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!decision ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision Payload (editable)</label>
              <textarea
                className="w-full h-64 p-3 rounded-md border bg-muted/30 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={editedJson}
                onChange={(e) => onEditJson(e.target.value)}
              />
            </div>
            <Button onClick={onSubmit} disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'POST /decisions'}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={decision.status} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <span className="text-xs text-muted-foreground">Decision ID</span>
                <p className="font-mono text-sm break-all">{decision.id}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Input Hash</span>
                <p className="font-mono text-xs break-all">{decision.inputHash}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Signature</span>
                <p className="font-mono text-xs break-all truncate">{decision.signature ?? 'N/A'}</p>
              </div>
            </div>

            <UnderTheHood>
              <CodeBlock title="POST /decisions — Request">
                {editedJson}
              </CodeBlock>
              <CodeBlock title="Response">
                {JSON.stringify({ success: true, data: decision }, null, 2)}
              </CodeBlock>
            </UnderTheHood>

            <div className="flex justify-end pt-2">
              <Button onClick={onNext}>Next: On-Chain Anchor</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
