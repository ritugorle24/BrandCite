import { NextResponse } from 'next/server';
import { getCurrentUserRole } from '@/lib/authHelpers';

export async function GET() {
  const role = await getCurrentUserRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ secret: 'admin data' });
}
