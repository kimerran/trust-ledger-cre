import type { Metadata } from 'next';
import { auth } from '../../lib/auth';
import { decisionsApi } from '../../lib/api';
import { AuditTable } from '../../components/AuditTable';

export const metadata: Metadata = {
  title: 'Audit Log',
  description: 'Browse and search AI decision audit records',
};

export default async function AuditPage() {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? '';

  let decisions: Awaited<ReturnType<typeof decisionsApi.list>> = [];
  try {
    if (token) {
      decisions = await decisionsApi.list(token);
    }
  } catch (err) {
    console.error('[audit] API fetch failed:', err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          {decisions.length} decision{decisions.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      <AuditTable decisions={decisions} />
    </div>
  );
}
