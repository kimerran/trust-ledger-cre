'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Decision } from '@trustledger/shared';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface AuditTableProps {
  decisions: Decision[];
}

function StatusBadge({ status }: { status: Decision['status'] }) {
  const variantMap: Record<Decision['status'], 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
    PENDING: 'secondary',
    SIGNED: 'warning',
    ANCHORED: 'default',
    VERIFIED: 'success',
    FAILED: 'destructive',
  };
  return <Badge variant={variantMap[status]}>{status}</Badge>;
}

function RiskBadge({ level }: { level: Decision['riskLevel'] }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const variantMap: Record<NonNullable<Decision['riskLevel']>, 'success' | 'warning' | 'destructive'> = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'destructive',
  };
  return <Badge variant={variantMap[level]}>{level}</Badge>;
}

export function AuditTable({ decisions }: AuditTableProps) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? decisions.filter((d) => d.id.toLowerCase().includes(filter.toLowerCase()))
    : decisions;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Filter by Decision ID..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-md border bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          {filter ? 'No decisions match that ID.' : 'No decisions found.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Decision ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.id}</TableCell>
                <TableCell>{d.decisionType}</TableCell>
                <TableCell>{d.outcome}</TableCell>
                <TableCell>{(parseFloat(String(d.confidence)) * 100).toFixed(1)}%</TableCell>
                <TableCell>
                  <RiskBadge level={d.riskLevel} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(d.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/audit/${d.id}`}
                    className="text-primary underline underline-offset-4 text-sm"
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
