import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/drafts/:id/comments
 * Body: { body: string, parentId?: string }
 * Adds a comment to the draft. Only authenticated users can comment.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { body, parentId } = await req.json();
  if (!body) {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { error: insertErr } = await supabaseAdmin.from('comments').insert({
    draft_id: id,
    author_id: user.id,
    parent_id: parentId ?? null,
    body,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Comment added' }, { status: 201 });
}

/**
 * GET /api/drafts/:id/comments
 * Returns all comments for the draft ordered by creation time.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { data: comments, error: fetchErr } = await supabaseAdmin
    .from('comments')
    .select('id, author_id, body, created_at, parent_id')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  return NextResponse.json({ comments });
}
