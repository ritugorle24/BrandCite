import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewDraft } from '@/lib/review';
import { reviewConfig } from '@/lib/config';

export async function GET(req: Request) {
  try {
    // Auth
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isStaff = profile && ['manager', 'admin'].includes(profile.role);
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const scopeParam = url.searchParams.get('scope');

    let query = supabaseAdmin
      .from('drafts')
      .select('id, title, status, current_version, author_id, created_at');

    if (isStaff && statusParam) {
      query = query.eq('status', statusParam);
    } else if (isStaff && scopeParam === 'all') {
      // all drafts for staff
    } else {
      query = query.eq('author_id', user.id);
    }

    const { data: drafts, error: draftsError } = await query.order('created_at', {
      ascending: false,
    });

    if (draftsError) {
      console.error('[api/drafts] List error:', draftsError);
      return NextResponse.json(
        { error: 'Failed to fetch drafts', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ drafts }, { status: 200 });
  } catch (err: any) {
    console.error('[api/drafts] GET error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

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

    const { title, content } = body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'title and content required', code: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'title and content required', code: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      );
    }

    if (title.trim().length > 200) {
      return NextResponse.json(
        {
          error: 'Field "title" exceeds the maximum allowed length of 200 characters.',
          code: 'INPUT_TOO_LONG',
        },
        { status: 422 }
      );
    }

    if (content.length > reviewConfig.maxDraftLength) {
      return NextResponse.json(
        {
          error: `Field "content" exceeds the maximum allowed length of ${reviewConfig.maxDraftLength} characters.`,
          code: 'INPUT_TOO_LONG',
        },
        { status: 422 }
      );
    }

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

    // 1. Insert draft
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('drafts')
      .insert({ author_id: user.id, title: title.trim() })
      .select('*')
      .single();

    if (draftErr || !draft) {
      console.error('[api/drafts] Draft create error:', draftErr);
      return NextResponse.json(
        { error: 'Failed to create draft', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 2. Insert version 1
    const { error: versionErr } = await supabaseAdmin
      .from('draft_versions')
      .insert({
        draft_id: draft.id,
        version_no: 1,
        content: content.trim(),
        created_by: user.id,
      });

    if (versionErr) {
      console.error('[api/drafts] Version create error:', versionErr);
      return NextResponse.json(
        { error: 'Failed to create draft version', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 3. Run review and store findings (linked to version 1)
    const findings = await reviewDraft(content.trim());
    const insertFindings = findings.map((f) => ({
      draft_id: draft.id,
      version_no: 1,
      source_id: f.source_id ?? null,
      issue: f.issue,
      quote: f.quote ?? null,
      severity: f.severity ?? 'medium',
      suggestion: f.suggestion ?? null,
      confidence: f.confidence ?? 1,
      status: f.status ?? 'open',
      escalation_reason: f.escalation_reason ?? null,
      ai_assisted: f.ai_assisted ?? false,
    }));

    if (insertFindings.length > 0) {
      const { error: findingsErr } = await supabaseAdmin
        .from('findings')
        .insert(insertFindings);

      if (findingsErr) {
        console.error('[api/drafts] Findings insert error:', findingsErr);
        // Note: Findings insert failure shouldn't crash draft creation if draft exists, but return safe error
        return NextResponse.json(
          { error: 'Failed to record review findings', code: 'DATABASE_ERROR' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ draftId: draft.id }, { status: 201 });
  } catch (err: any) {
    console.error('[api/drafts] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
