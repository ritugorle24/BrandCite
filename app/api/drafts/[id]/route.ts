import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/drafts/:id
 * Returns the draft record, all its versions, and findings for the current version.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Unauthenticated', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // Fetch draft
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (draftErr || !draft) {
      return NextResponse.json(
        { error: 'Draft not found', code: 'DRAFT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isStaff = profile && ['manager', 'admin'].includes(profile.role);

    if (draft.author_id !== user.id && !isStaff) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Fetch all versions for this draft
    const { data: versions, error: versionsErr } = await supabaseAdmin
      .from('draft_versions')
      .select('version_no, content, created_at')
      .eq('draft_id', id)
      .order('version_no', { ascending: true });

    if (versionsErr) {
      console.error('[api/drafts/[id]] Versions fetch error:', versionsErr);
      return NextResponse.json(
        { error: 'Failed to fetch draft versions', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Fetch findings for the current version only
    const { data: findings, error: findingsErr } = await supabaseAdmin
      .from('findings')
      .select('*')
      .eq('draft_id', id)
      .eq('version_no', draft.current_version);

    if (findingsErr) {
      console.error('[api/drafts/[id]] Findings fetch error:', findingsErr);
      return NextResponse.json(
        { error: 'Failed to fetch draft findings', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      draft,
      versions: versions ?? [],
      findings: findings ?? [],
    });
  } catch (err: any) {
    console.error('[api/drafts/[id]] GET error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
