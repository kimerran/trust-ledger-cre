'use client';

import { Card, CardContent } from '@/components/ui/card';

interface VerificationLayerCardProps {
  title: string;
  pass: boolean;
  details: Record<string, string | number | boolean | null>;
}

export function VerificationLayerCard({ title, pass, details }: VerificationLayerCardProps) {
  return (
    <Card className={`border-2 ${pass ? 'border-green-500/50' : 'border-red-500/50'}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg ${pass ? 'text-green-600' : 'text-red-600'}`}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <dl className="space-y-1">
          {Object.entries(details).filter(([, value]) => value != null).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <dt className="text-muted-foreground min-w-[100px]">{key}:</dt>
              <dd className="font-mono break-all">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
