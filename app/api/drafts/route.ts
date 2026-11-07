import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewDraft } from '@/lib/review';

export async function GET(req: Request) {
  // Auth
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
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

  const { data: drafts, error: draftsError } = await query.order('created_at', { ascending: false });

  if (draftsError) {
    console.error('[api/drafts] List error:', draftsError);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }

  return NextResponse.json({ drafts }, { status: 200 });
}

// Existing POST endpoint follows

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

  return NextResponse.json({ draftId: draft.id }, { status: 201 });
}
