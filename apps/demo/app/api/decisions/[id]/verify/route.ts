import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/constants';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = req.headers.get('authorization');

  const res = await fetch(`${API_BASE_URL}/decisions/${params.id}/verify`, {
    headers: {
      ...(token ? { Authorization: token } : {}),
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
