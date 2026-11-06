import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewDraft } from '@/lib/review';

/**
 * POST /api/drafts/:id/versions
 * Body: { content: string }
 * Creates a new version for the draft, runs review, stores findings for that version.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content } = await req.json();

  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Verify that the draft exists and belongs to the user
  const { data: draft, error: draftErr } = await supabaseAdmin
    .from('drafts')
    .select('author_id, current_version')
    .eq('id', id)
    .single();
  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: 404 });
  }
  if (draft.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const newVersion = draft.current_version + 1;

  // Insert new version row
  const { error: versionErr } = await supabaseAdmin
    .from('draft_versions')
    .insert({
      draft_id: id,
      version_no: newVersion,
      content,
      created_by: user.id,
    });
  if (versionErr) {
    return NextResponse.json({ error: versionErr.message }, { status: 500 });
  }

  // Update drafts.current_version
  const { error: updateErr } = await supabaseAdmin
    .from('drafts')
    .update({ current_version: newVersion })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Run review on new content
  const findings = await reviewDraft(content);
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
    const { error: findingsErr } = await supabaseAdmin.from('findings').insert(insertFindings);
    if (findingsErr) {
      return NextResponse.json({ error: findingsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ version: newVersion }, { status: 201 });
}
