import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/drafts/:id/comments
 * Body: { body: string, parentId?: string }
 * Adds a comment to the draft. Only authenticated users can comment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let parsed: any;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { body, parentId } = parsed || {};

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return NextResponse.json(
        { error: 'body required', code: 'MISSING_FIELD' },
        { status: 400 }
      );
    }

    if (body.trim().length > 2000) {
      return NextResponse.json(
        {
          error: 'Comment body exceeds maximum allowed length of 2000 characters.',
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

    const { error: insertErr } = await supabaseAdmin.from('comments').insert({
      draft_id: id,
      author_id: user.id,
      parent_id: parentId ?? null,
      body: body.trim(),
    });

    if (insertErr) {
      console.error('[api/drafts/[id]/comments] Insert error:', insertErr);
      return NextResponse.json(
        { error: 'Failed to post comment', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Comment added' }, { status: 201 });
  } catch (err: any) {
    console.error('[api/drafts/[id]/comments] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drafts/:id/comments
 * Returns all comments for the draft ordered by creation time.
 */
export async function GET(
  req: Request,
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

    const { data: comments, error: fetchErr } = await supabaseAdmin
      .from('comments')
      .select('id, author_id, body, created_at, parent_id')
      .eq('draft_id', id)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      console.error('[api/drafts/[id]/comments] Fetch error:', fetchErr);
      return NextResponse.json(
        { error: 'Failed to fetch comments', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comments: comments ?? [] }, { status: 200 });
  } catch (err: any) {
    console.error('[api/drafts/[id]/comments] GET error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
