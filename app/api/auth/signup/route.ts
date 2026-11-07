import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/signup
 * Body: { email: string, password: string }
 * Creates a Supabase auth user and a profile row with role 'creator'.
 */
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { email, password } = body || {};
    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password required', code: 'MISSING_CREDENTIALS' },
        { status: 400 }
      );
    }

    // Sign up via Supabase auth (client uses anon key)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return NextResponse.json(
        { error: signUpError.message || 'Signup failed', code: 'SIGNUP_FAILED' },
        { status: 400 }
      );
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unable to obtain user id', code: 'USER_ID_MISSING' },
        { status: 500 }
      );
    }

    // Insert profile row using admin client (service role) – bypass RLS for initial creation
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, email, role: 'creator' });

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to create user profile.', code: 'PROFILE_CREATION_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'User created', userId }, { status: 201 });
  } catch (err: any) {
    console.error('[api/auth/signup] Error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
