import type { Decision } from '@trustledger/shared';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface StatsBarProps {
  decisions: Decision[];
}

export function StatsBar({ decisions }: StatsBarProps) {
  const total = decisions.length;
  const verified = decisions.filter((d) => d.status === 'VERIFIED').length;
  const failed = decisions.filter((d) => d.status === 'FAILED').length;
  const anchored = decisions.filter((d) => d.status === 'ANCHORED').length;
  const highRisk = decisions.filter((d) => d.riskLevel === 'HIGH').length;

  const stats = [
    { label: 'Total Decisions', value: total, description: 'All time' },
    { label: 'Verified', value: verified, description: 'Fully verified on-chain' },
    { label: 'Anchored', value: anchored, description: 'On Ethereum Sepolia' },
    { label: 'High Risk', value: highRisk, description: 'Flagged by LLM' },
    { label: 'Failed', value: failed, description: 'Processing errors' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{s.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
