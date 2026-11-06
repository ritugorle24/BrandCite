import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/drafts/:id
 * Returns the draft record, all its versions, and findings for the current version.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Fetch draft (any authenticated user can view)
  const { data: draft, error: draftErr } = await supabaseAdmin
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();
  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: draftErr.code === 'PGRST116' ? 404 : 500 });
  }
if (draft.author_id !== user.id) {
  return NextResponse.json(
    { error: 'Forbidden' },
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
    return NextResponse.json({ error: versionsErr.message }, { status: 500 });
  }

  // Fetch findings for the current version only
  const { data: findings, error: findingsErr } = await supabaseAdmin
    .from('findings')
    .select('*')
    .eq('draft_id', id)
    .eq('version_no', draft.current_version);
  if (findingsErr) {
    return NextResponse.json({ error: findingsErr.message }, { status: 500 });
  }

  return NextResponse.json({ draft, versions, findings });
}