'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionStatus } from '@trustledger/shared';

const statusVariant: Record<DecisionStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'secondary',
  SIGNED: 'default',
  ANCHORED: 'warning',
  VERIFIED: 'success',
  FAILED: 'destructive',
};

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}
