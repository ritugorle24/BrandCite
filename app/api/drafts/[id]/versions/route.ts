import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewDraft } from '@/lib/review';
import { reviewConfig } from '@/lib/config';

/**
 * POST /api/drafts/:id/versions
 * Body: { content: string }
 * Creates a new version for the draft, runs review, stores findings for that version.
 */
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

    const { content } = body || {};

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content required', code: 'MISSING_FIELD' },
        { status: 400 }
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

    // Verify that the draft exists and belongs to the user
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('drafts')
      .select('author_id, current_version')
      .eq('id', id)
      .single();

    if (draftErr || !draft) {
      return NextResponse.json(
        { error: 'Draft not found', code: 'DRAFT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (draft.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const newVersion = draft.current_version + 1;

    // Insert new version row
    const { error: versionErr } = await supabaseAdmin
      .from('draft_versions')
      .insert({
        draft_id: id,
        version_no: newVersion,
        content: content.trim(),
        created_by: user.id,
      });

    if (versionErr) {
      console.error('[api/drafts/[id]/versions] Version create error:', versionErr);
      return NextResponse.json(
        { error: 'Failed to create new draft version', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Update drafts.current_version
    const { error: updateErr } = await supabaseAdmin
      .from('drafts')
      .update({ current_version: newVersion })
      .eq('id', id);

    if (updateErr) {
      console.error('[api/drafts/[id]/versions] Version update error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update current version', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Run review and store findings
    const findings = await reviewDraft(content.trim());
    const insertFindings = findings.map((f) => ({
      draft_id: id,
      version_no: newVersion,
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
        console.error('[api/drafts/[id]/versions] Findings insert error:', findingsErr);
      }
    }

    return NextResponse.json(
      { version: newVersion, draftId: id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[api/drafts/[id]/versions] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
