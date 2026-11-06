import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VALID_DECISIONS = ['confirmed', 'dismissed'] as const;
type ResolveDecision = (typeof VALID_DECISIONS)[number];

/**
 * POST /api/findings/:id/resolve
 *
 * Allows a manager or admin to confirm or dismiss a finding that is
 * currently in `needs_human` status.
 *
 * Request body:
 * { "decision": "confirmed" | "dismissed", "note": "..." }
 *
 * On confirm  → status changes to 'open'   (needs further action by author)
 * On dismiss  → status changes to 'rejected' (false positive)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }

    const decision: string | undefined = body?.decision;
    const note: string | undefined = body?.note;

    if (!decision || !VALID_DECISIONS.includes(decision as ResolveDecision)) {
      return NextResponse.json(
        { error: `Decision must be one of: ${VALID_DECISIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // 2. Auth
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // 3. Role check — managers and admins only
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Unable to determine user role' },
        { status: 403 }
      );
    }

    if (!['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: managers and admins only' },
        { status: 403 }
      );
    }

    // 4. Fetch the finding — must exist and must be in needs_human state
    const { data: finding, error: findingError } = await supabaseAdmin
      .from('findings')
      .select('id, status')
      .eq('id', id)
      .single();

    if (findingError || !finding) {
      return NextResponse.json(
        { error: 'Finding not found' },
        { status: 404 }
      );
    }

    if (finding.status !== 'needs_human') {
      return NextResponse.json(
        { error: `Finding is not awaiting human review (current status: ${finding.status})` },
        { status: 409 }
      );
    }

    // 5. Map decision to DB status
    const newStatus = decision === 'confirmed' ? 'open' : 'rejected';

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('findings')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        resolution_note: note ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[api/findings/resolve] Update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // 6. Audit log entry
    await supabaseAdmin.from('audit_log').insert({
      actor_id: user.id,
      action: `finding.${decision}`,
      entity_type: 'finding',
      entity_id: id,
      payload: { decision, note: note ?? null, new_status: newStatus },
    });

    return NextResponse.json(
      { message: `Finding ${decision} successfully`, finding: updated },
      { status: 200 }
    );
  } catch (err) {
    console.error('[api/findings/resolve] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
