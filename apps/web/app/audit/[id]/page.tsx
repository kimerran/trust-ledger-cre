import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '../../../lib/auth';
import { decisionsApi } from '../../../lib/api';
import { VerificationLayers } from '../../../components/VerificationLayers';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Decision ${params.id.slice(0, 10)}…`,
    description: 'AI decision drilldown — hash, signature, and on-chain proof',
  };
}

export default async function DecisionDrilldownPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? '';

  if (!token) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Please sign in to view decision details.</p>
      </div>
    );
  }

  let decision: Awaited<ReturnType<typeof decisionsApi.get>>;
  try {
    decision = await decisionsApi.get(params.id, token);
  } catch {
    notFound();
  }

  let verification: Awaited<ReturnType<typeof decisionsApi.verify>> | null = null;
  try {
    verification = await decisionsApi.verify(params.id, token);
  } catch {
    // Verification can fail — show what we have
  }

  const statusVariant = {
    PENDING: 'secondary' as const,
    SIGNED: 'warning' as const,
    ANCHORED: 'default' as const,
    VERIFIED: 'success' as const,
    FAILED: 'destructive' as const,
  }[decision.status];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/audit" className="text-sm text-muted-foreground hover:text-foreground">
            ← Audit Log
          </Link>
          <h1 className="text-2xl font-bold mt-2 font-mono">{decision.id}</h1>
        </div>
        <div className="flex gap-2">
          <Badge variant={statusVariant}>{decision.status}</Badge>
          <Link href={`/verify/${decision.id}`}>
            <Button variant="outline" size="sm">
              Public Proof
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Type" value={decision.decisionType} />
            <Row label="Outcome" value={decision.outcome} />
            <Row
              label="Confidence"
              value={`${(parseFloat(String(decision.confidence)) * 100).toFixed(1)}%`}
            />
            <Row label="Risk Level" value={decision.riskLevel ?? '—'} />
            <Row
              label="Created"
              value={new Date(decision.createdAt).toLocaleString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cryptographic Proof</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Input Hash</p>
              <code className="text-xs break-all">{decision.inputHash}</code>
            </div>
            {decision.signature && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">KMS Signature</p>
                <code className="text-xs break-all">{decision.signature.slice(0, 64)}…</code>
              </div>
            )}
            {decision.txHash && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${decision.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline break-all"
                >
                  {decision.txHash}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {decision.riskSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">LLM Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{decision.riskSummary}</p>
          </CardContent>
        </Card>
      )}

      {verification ? (
        <VerificationLayers result={verification} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Verification not yet available
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Features</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(decision.topFeatures, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
