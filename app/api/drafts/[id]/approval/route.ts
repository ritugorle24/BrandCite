import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUserRole } from '@/lib/authHelpers';

/**
 * POST /api/drafts/:id/approval
 * Body: { decision: 'approved' | 'changes_requested', note?: string }
 * Manager or admin can move draft from 'in_review' to the chosen status.
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

    const { decision, note } = body || {};

    if (!decision || !['approved', 'changes_requested'].includes(decision)) {
      return NextResponse.json(
        {
          error: 'Invalid decision: must be "approved" or "changes_requested"',
          code: 'INVALID_DECISION',
        },
        { status: 400 }
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

    const role = await getCurrentUserRole();
    if (!role || !['manager', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden: managers and admins only', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Fetch draft
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('drafts')
      .select('id, status')
      .eq('id', id)
      .single();

    if (draftErr || !draft) {
      return NextResponse.json(
        { error: 'Draft not found', code: 'DRAFT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Only allow transition from in_review
    if (draft.status !== 'in_review') {
      return NextResponse.json(
        {
          error: 'Invalid transition: draft must be in "in_review" status to approve or request changes',
          code: 'INVALID_TRANSITION',
        },
        { status: 409 }
      );
    }

    const newStatus = decision === 'approved' ? 'approved' : 'changes_requested';

    const { error: updateErr } = await supabaseAdmin
      .from('drafts')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateErr) {
      console.error('[api/drafts/[id]/approval] Update error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to record approval decision', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Log approval record
    await supabaseAdmin.from('approvals').insert({
      draft_id: id,
      manager_id: user.id,
      decision,
      note: typeof note === 'string' ? note.trim() : null,
    });

    // Log audit
    await supabaseAdmin.from('audit_log').insert({
      actor_id: user.id,
      action: `draft.${decision}`,
      entity_type: 'draft',
      entity_id: id,
      payload: { from: draft.status, to: newStatus, note },
    });

    return NextResponse.json(
      { draftId: id, status: newStatus, decision },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[api/drafts/[id]/approval] POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
