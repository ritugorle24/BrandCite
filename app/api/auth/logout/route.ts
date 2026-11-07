import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Logout failed', code: 'LOGOUT_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Logged out' });
  } catch (err: any) {
    console.error('[api/auth/logout] Error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
