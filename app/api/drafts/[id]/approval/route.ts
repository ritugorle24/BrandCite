import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUserRole } from '@/lib/authHelpers';

/**
 * POST /api/drafts/:id/approval
 * Body: { decision: 'approved' | 'changes_requested', note?: string }
 * Manager or admin can move draft from 'in_review' to the chosen status.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision, note } = await req.json();
  if (!decision || !['approved', 'changes_requested'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const role = await getCurrentUserRole();
  if (!role || !['manager', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch draft
  const { data: draft, error: draftErr } = await supabaseAdmin
    .from('drafts')
    .select('id, status')
    .eq('id', id)
    .single();
  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: 404 });
  }

  // Only allow transition from in_review
  if (draft.status !== 'in_review') {
    return NextResponse.json({ error: 'Invalid transition' }, { status: 409 });
  }

  const newStatus = decision === 'approved' ? 'approved' : 'changes_requested';

  const { error: updateErr } = await supabaseAdmin
    .from('drafts')
    .update({ status: newStatus })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Log audit
  await supabaseAdmin.from('audit_log').insert({
    actor_id: user.id,
    action: `draft.${decision}`,
    entity_type: 'draft',
    entity_id: id,
    payload: { from: draft.status, to: newStatus, note },
  });

  return NextResponse.json({ draftId: id, status: newStatus });
}
