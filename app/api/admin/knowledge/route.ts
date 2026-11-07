import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUnapprovedTermIds, recordTermApprovalStatus } from '@/lib/knowledge';

/**
 * Helper to authenticate and verify admin role.
 */
async function authenticateAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthenticated', status: 401, user: null };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Unable to determine user role', status: 403, user: null };
  }

  if (profile.role !== 'admin') {
    return { error: 'Forbidden: admin access required', status: 403, user: null };
  }

  return { error: null, status: 200, user };
}

/**
 * GET /api/admin/knowledge
 * Returns all rules, facts, and terms (including approval status).
 */
export async function GET() {
  const auth = await authenticateAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [
      { data: rules, error: rulesErr },
      { data: facts, error: factsErr },
      { data: terms, error: termsErr },
      unapprovedTermIds,
    ] = await Promise.all([
      supabaseAdmin
        .from('brand_rules')
        .select('*')
        .order('id', { ascending: true }),
      supabaseAdmin
        .from('approved_facts')
        .select('*')
        .order('id', { ascending: true }),
      supabaseAdmin
        .from('terms')
        .select('*')
        .order('created_at', { ascending: true }),
      getUnapprovedTermIds(supabaseAdmin),
    ]);

    if (rulesErr) throw rulesErr;
    if (factsErr) throw factsErr;
    if (termsErr) throw termsErr;

    const termsWithApproval = (terms ?? []).map((term) => ({
      ...term,
      approved:
        term.approved !== undefined
          ? Boolean(term.approved)
          : !unapprovedTermIds.has(term.id),
    }));

    return NextResponse.json(
      {
        rules: rules ?? [],
        facts: facts ?? [],
        terms: termsWithApproval,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[api/admin/knowledge] GET error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch knowledge base items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/knowledge
 * Creates a new rule, fact, or term.
 */
export async function POST(req: Request) {
  const auth = await authenticateAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { entity, data } = body;

    if (!entity || !data) {
      return NextResponse.json(
        { error: 'Missing entity type or data payload' },
        { status: 400 }
      );
    }

    if (entity === 'rule') {
      if (!data.id || !data.category || !data.text) {
        return NextResponse.json(
          { error: 'Missing required rule fields (id, category, text)' },
          { status: 400 }
        );
      }

      const { data: created, error } = await supabaseAdmin
        .from('brand_rules')
        .insert({
          id: data.id.trim(),
          category: data.category.trim(),
          text: data.text.trim(),
          severity: data.severity || 'medium',
          approved: Boolean(data.approved),
          approved_by: data.approved ? auth.user!.id : null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ item: created }, { status: 201 });
    }

    if (entity === 'fact') {
      if (!data.id || !data.statement) {
        return NextResponse.json(
          { error: 'Missing required fact fields (id, statement)' },
          { status: 400 }
        );
      }

      const { data: created, error } = await supabaseAdmin
        .from('approved_facts')
        .insert({
          id: data.id.trim(),
          statement: data.statement.trim(),
          source_note: data.source_note?.trim() || null,
          valid_until: data.valid_until || null,
          approved: Boolean(data.approved),
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ item: created }, { status: 201 });
    }

    if (entity === 'term') {
      if (!data.term || !data.type) {
        return NextResponse.json(
          { error: 'Missing required term fields (term, type)' },
          { status: 400 }
        );
      }

      const termPayload: any = {
        term: data.term.trim(),
        type: data.type,
        replacement: data.replacement?.trim() || null,
        rule_id: data.rule_id?.trim() || null,
      };

      const { data: created, error } = await supabaseAdmin
        .from('terms')
        .insert(termPayload)
        .select('*')
        .single();

      if (error) throw error;

      const isApproved = data.approved !== undefined ? Boolean(data.approved) : true;
      if (!isApproved) {
        await recordTermApprovalStatus(supabaseAdmin, created.id, false, auth.user!.id);
      }

      return NextResponse.json(
        { item: { ...created, approved: isApproved } },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/knowledge] POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create knowledge item' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/knowledge
 * Updates or toggles approval for a rule, fact, or term.
 */
export async function PATCH(req: Request) {
  const auth = await authenticateAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { entity, id, updates } = body;

    if (!entity || !id || !updates) {
      return NextResponse.json(
        { error: 'Missing entity, id, or updates payload' },
        { status: 400 }
      );
    }

    if (entity === 'rule') {
      const payload: any = { ...updates };
      if (updates.approved !== undefined) {
        payload.approved = Boolean(updates.approved);
        payload.approved_by = updates.approved ? auth.user!.id : null;
      }

      const { data: updated, error } = await supabaseAdmin
        .from('brand_rules')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ item: updated }, { status: 200 });
    }

    if (entity === 'fact') {
      const payload: any = { ...updates };
      if (updates.valid_until === '') {
        payload.valid_until = null;
      }
      if (updates.approved !== undefined) {
        payload.approved = Boolean(updates.approved);
      }

      const { data: updated, error } = await supabaseAdmin
        .from('approved_facts')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ item: updated }, { status: 200 });
    }

    if (entity === 'term') {
      const payload: any = {};
      if (updates.term !== undefined) payload.term = updates.term.trim();
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.replacement !== undefined) payload.replacement = updates.replacement?.trim() || null;
      if (updates.rule_id !== undefined) payload.rule_id = updates.rule_id?.trim() || null;

      let updatedTerm: any = null;
      if (Object.keys(payload).length > 0) {
        const { data, error } = await supabaseAdmin
          .from('terms')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (error) throw error;
        updatedTerm = data;
      } else {
        const { data, error } = await supabaseAdmin
          .from('terms')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        updatedTerm = data;
      }

      let currentApproved = true;
      if (updates.approved !== undefined) {
        currentApproved = Boolean(updates.approved);
        await recordTermApprovalStatus(supabaseAdmin, id, currentApproved, auth.user!.id);
      } else {
        const unapprovedIds = await getUnapprovedTermIds(supabaseAdmin);
        currentApproved = !unapprovedIds.has(id);
      }

      return NextResponse.json(
        { item: { ...updatedTerm, approved: currentApproved } },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/knowledge] PATCH error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update knowledge item' },
      { status: 500 }
    );
  }
}

