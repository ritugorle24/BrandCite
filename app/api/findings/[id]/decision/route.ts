import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { decision } = body || {};

    if (!decision || !['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json(
        {
          error: 'Decision must be accepted or rejected',
          code: 'INVALID_DECISION',
        },
        { status: 400 }
      );
    }

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

    // Find the finding
    const { data: finding, error: findingError } = await supabaseAdmin
      .from('findings')
      .select('id, draft_id')
      .eq('id', id)
      .single();

    if (findingError || !finding) {
      return NextResponse.json(
        { error: 'Finding not found', code: 'FINDING_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify draft ownership
    const { data: draft, error: draftError } = await supabaseAdmin
      .from('drafts')
      .select('author_id')
      .eq('id', finding.draft_id)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found', code: 'DRAFT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (draft.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: only draft author can record finding decision', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Save the decision and reviewer
    const { data, error } = await supabaseAdmin
      .from('findings')
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/findings/decision] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to record decision', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Decision saved successfully',
        finding: data,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[api/findings/decision] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
