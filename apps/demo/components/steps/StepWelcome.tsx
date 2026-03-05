'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PipelineDiagram } from '@/components/PipelineDiagram';

interface StepWelcomeProps {
  onBegin: () => void;
  isLoading: boolean;
}

export function StepWelcome({ onBegin, isLoading }: StepWelcomeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Decision Audit Trail</CardTitle>
        <CardDescription>
          Walk through the full TrustLedger pipeline step by step. You&apos;ll submit an AI
          decision, anchor it on-chain, verify it with 3 independent layers, and download a
          tamper-proof audit proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PipelineDiagram />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2 p-4 rounded-md bg-muted/50">
            <p className="font-semibold">What you&apos;ll see:</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li>Canonical hash computation (RFC 8785)</li>
              <li>KMS digital signature</li>
              <li>Blockchain anchoring via Chainlink CRE</li>
              <li>Three-layer independent verification</li>
              <li>Downloadable audit proof artifact</li>
            </ul>
          </div>
          <div className="space-y-2 p-4 rounded-md bg-muted/50">
            <p className="font-semibold">Prerequisites:</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li>API running on localhost:3001</li>
              <li>Database seeded with demo data</li>
              <li>Docker services running (Postgres + Redis)</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Button size="lg" onClick={onBegin} disabled={isLoading}>
            {isLoading ? 'Initializing...' : 'Begin Demo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
