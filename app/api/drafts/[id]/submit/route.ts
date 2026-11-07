import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/drafts/:id/submit
 * Author (creator) moves draft from 'draft' or 'changes_requested' -> 'in_review'.
 */
export async function POST(
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

    // Fetch draft
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('drafts')
      .select('id, author_id, status')
      .eq('id', id)
      .single();

    if (draftErr || !draft) {
      return NextResponse.json(
        { error: 'Draft not found', code: 'DRAFT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Only author can submit
    if (draft.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Allowed current statuses
    if (!['draft', 'changes_requested'].includes(draft.status)) {
      return NextResponse.json(
        {
          error: 'Invalid transition: only drafts in "draft" or "changes_requested" status can be submitted',
          code: 'INVALID_TRANSITION',
        },
        { status: 409 }
      );
    }

    const newStatus = 'in_review';

    const { error: updateErr } = await supabaseAdmin
      .from('drafts')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateErr) {
      console.error('[api/drafts/[id]/submit] Update error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to submit draft for review', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      actor_id: user.id,
      action: 'draft.submit',
      entity_type: 'draft',
      entity_id: id,
      payload: { from: draft.status, to: newStatus },
    });

    return NextResponse.json({ draftId: id, status: newStatus }, { status: 200 });
  } catch (err: any) {
    console.error('[api/drafts/[id]/submit] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
