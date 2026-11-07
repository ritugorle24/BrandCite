import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/review-queue
 *
 * Returns all findings with status = 'needs_human', joined with their
 * parent draft title.  Only accessible to managers and admins.
 */
export async function GET() {
  try {
    // 1. Auth — must be logged in
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthenticated', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // 2. Role check — managers and admins only
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Unable to determine user role', code: 'ROLE_UNKNOWN' },
        { status: 403 }
      );
    }

    if (!['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: managers and admins only', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 3. Query — findings with needs_human joined to drafts
    const { data: findings, error: findingsError } = await supabaseAdmin
      .from('findings')
      .select(
        `
        id,
        draft_id,
        version_no,
        source_id,
        issue,
        quote,
        severity,
        suggestion,
        confidence,
        status,
        escalation_reason,
        ai_assisted,
        created_at,
        drafts!inner ( title )
      `
      )
      .eq('status', 'needs_human')
      .order('created_at', { ascending: false });

    if (findingsError) {
      console.error('[api/review-queue] Query error:', findingsError);
      return NextResponse.json(
        { error: 'Failed to fetch review queue', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 4. Flatten the joined draft title into each row
    const queue = (findings ?? []).map((f: any) => ({
      id: f.id,
      draft_id: f.draft_id,
      draft_title: f.drafts?.title ?? null,
      version_no: f.version_no,
      source_id: f.source_id,
      issue: f.issue,
      quote: f.quote,
      severity: f.severity,
      suggestion: f.suggestion,
      confidence: f.confidence,
      escalation_reason: f.escalation_reason ?? null,
      ai_assisted: f.ai_assisted,
      created_at: f.created_at,
    }));

    return NextResponse.json({ queue }, { status: 200 });
  } catch (err: any) {
    console.error('[api/review-queue] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
