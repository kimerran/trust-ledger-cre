import type { Metadata } from 'next';
import { auth } from '../../lib/auth';
import { modelsApi } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export const metadata: Metadata = {
  title: 'Model Registry',
  description: 'Registered AI models tracked by TrustLedger',
};

export default async function ModelsPage() {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? '';

  let models: Awaited<ReturnType<typeof modelsApi.list>> = [];
  try {
    if (token) {
      models = await modelsApi.list(token);
    }
  } catch (err) {
    console.error('[models] API fetch failed:', err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Model Registry</h1>
        <p className="text-muted-foreground mt-1">
          {models.length} registered AI model{models.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Models</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {models.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No models registered yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="font-mono text-xs">{m.version}</TableCell>
                    <TableCell>{m.modelType}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? 'success' : 'secondary'}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(m.createdAt).toLocaleDateString()}
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
