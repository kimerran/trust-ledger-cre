import { NextResponse } from 'next/server';
import { signApiToken } from '@/lib/jwt';
import { AUTH_SECRET, DEMO_TENANT_ID, DEMO_USER_EMAIL } from '@/lib/constants';

export async function POST() {
  if (!AUTH_SECRET) {
    return NextResponse.json(
      { error: 'AUTH_SECRET / NEXTAUTH_SECRET not configured' },
      { status: 500 },
    );
  }

  const token = await signApiToken(
    { sub: DEMO_USER_EMAIL, tenantId: DEMO_TENANT_ID },
    AUTH_SECRET,
  );

  return NextResponse.json({ token });
}
