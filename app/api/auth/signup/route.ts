import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/signup
 * Body: { email: string, password: string }
 * Creates a Supabase auth user and a profile row with role 'creator'.
 */
export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }
  // Sign up via Supabase auth (client uses anon key)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }
  const userId = signUpData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to obtain user id' }, { status: 500 });
  }
  // Insert profile row using admin client (service role) – bypass RLS for initial creation
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: userId, email, role: 'creator' });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  return NextResponse.json({ message: 'User created', userId });
}
