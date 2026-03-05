import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerificationLayers } from '../../../components/VerificationLayers';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Verify Decision ${params.id.slice(0, 10)}…`,
    description: 'Public cryptographic proof for an AI decision anchored on Ethereum Sepolia',
  };
}

/**
 * Public proof page — no auth required.
 * Fetches verification result from a public endpoint.
 */
export default async function PublicVerifyPage({ params }: { params: { id: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  // This is a public endpoint that doesn't require auth
  const res = await fetch(`${apiBase}/decisions/${params.id}/verify`, {
    headers: { Authorization: `Bearer public` },
    next: { revalidate: 60 },
  });

  if (res.status === 404) notFound();

  let verification: import('@trustledger/shared').VerificationResult | null = null;
  try {
    const json = (await res.json()) as { success: boolean; data: typeof verification };
    if (json.success) verification = json.data;
  } catch {
    // show error state
  }

  if (!verification) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-destructive">Verification Failed</h1>
          <p className="text-muted-foreground mt-2">Unable to retrieve proof for this decision.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="mb-4">
          Public Proof
        </Badge>
        <h1 className="text-2xl font-bold">AI Decision Proof</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">{params.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What is this?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This page provides cryptographic proof that an AI decision was recorded, signed, and
          anchored immutably to the Ethereum Sepolia blockchain. The three verification layers
          below confirm the integrity of the audit record.
        </CardContent>
      </Card>

      <VerificationLayers result={verification} />

      <p className="text-center text-xs text-muted-foreground">
        Powered by TrustLedger · Chainlink CRE · AWS KMS · Ethereum Sepolia
      </p>
    </div>
  );
}
