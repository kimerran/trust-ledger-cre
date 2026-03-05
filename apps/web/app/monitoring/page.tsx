import type { Metadata } from 'next';
import { auth } from '../../lib/auth';
import { workflowRunsApi } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export const metadata: Metadata = {
  title: 'Workflow Monitoring',
  description: 'Chainlink CRE workflow run history',
};

export default async function MonitoringPage() {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? '';

  let runs: Awaited<ReturnType<typeof workflowRunsApi.list>> = [];
  try {
    if (token) {
      runs = await workflowRunsApi.list(token);
    }
  } catch (err) {
    console.error('[monitoring] API fetch failed:', err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workflow Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Chainlink CRE execution history — {runs.length} run{runs.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No workflow runs yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 13)}…</TableCell>
                    <TableCell>{r.workflowName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.decisionId ? r.decisionId.slice(0, 10) + '…' : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'SUCCESS'
                            ? 'success'
                            : r.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.durationMs != null ? `${r.durationMs}ms` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
