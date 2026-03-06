import type { VerificationResult } from '@trustledger/shared';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface VerificationLayersProps {
  result: VerificationResult;
}

function LayerRow({
  label,
  pass,
  detail,
}: {
  label: string;
  pass: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <span className={`mt-0.5 text-lg ${pass ? 'text-green-500' : 'text-red-500'}`}>
        {pass ? '✓' : '✗'}
      </span>
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{detail}</p>
      </div>
      <Badge variant={pass ? 'success' : 'destructive'}>{pass ? 'PASS' : 'FAIL'}</Badge>
    </div>
  );
}

export function VerificationLayers({ result }: VerificationLayersProps) {
  const { layers, overall, verifiedAt } = result;

  const overallVariant =
    overall === 'PASS' ? 'success' : overall === 'FAIL' ? 'destructive' : 'warning';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Verification Result</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={overallVariant} className="text-sm px-3">
            {overall}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        <LayerRow
          label="Layer 1 — Hash Integrity"
          pass={layers.hashMatch.pass}
          detail={`Computed: ${layers.hashMatch.computed}`}
        />
        <LayerRow
          label="Layer 2 — KMS Signature"
          pass={layers.signatureValid.pass}
          detail={`Algorithm: ${layers.signatureValid.algorithm}`}
        />
        <LayerRow
          label="Layer 3 — On-chain Anchor (Sepolia)"
          pass={layers.onchainAnchor.pass}
          detail={
            layers.onchainAnchor.txHash
              ? `tx: ${layers.onchainAnchor.txHash}${layers.onchainAnchor.blockNumber != null ? ` | block: ${layers.onchainAnchor.blockNumber}` : ''}`
              : 'Not yet anchored'
          }
        />
        <p className="text-xs text-muted-foreground pt-3">
          Verified at: {new Date(verifiedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
