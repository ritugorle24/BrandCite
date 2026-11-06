import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewDraft } from '@/lib/review';

/**
 * POST /api/drafts
 * Body: { title: string, content: string }
 * Creates a draft, version 1, runs reviewDraft and stores findings.
 */
export async function POST(req: Request) {
  const { title, content } = await req.json();
  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // 1. Insert draft
  const { data: draft, error: draftErr } = await supabaseAdmin
    .from('drafts')
    .insert({ author_id: user.id, title })
    .select('*')
    .single();
  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: 500 });
  }

  // 2. Insert version 1
  const { error: versionErr } = await supabaseAdmin
    .from('draft_versions')
    .insert({
      draft_id: draft.id,
      version_no: 1,
      content,
      created_by: user.id,
    });
  if (versionErr) {
    return NextResponse.json({ error: versionErr.message }, { status: 500 });
  }

  // 3. Run review and store findings (linked to version 1)
  const findings = await reviewDraft(content);
  const insertFindings = findings.map((f) => ({
    draft_id: draft.id,
    version_no: 1,
    source_id: f.source_id ?? null,
    issue: f.issue,
    quote: f.quote ?? null,
    severity: f.severity ?? 'medium',
    suggestion: f.suggestion ?? null,
    confidence: f.confidence ?? 1,
    status: 'open',
    ai_assisted: f.ai_assisted ?? false,
  }));

  if (insertFindings.length > 0) {
    const { error: findingsErr } = await supabaseAdmin.from('findings').insert(insertFindings);
    if (findingsErr) {
      return NextResponse.json({ error: findingsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ draftId: draft.id }, { status: 201 });
}
