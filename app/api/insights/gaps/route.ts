import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateRuleGaps } from '@/lib/insights';

/**
 * GET /api/insights/gaps
 *
 * Returns a ranked list of brand rules with statistics about how often they
 * have been flagged by the review system and how often reviewers have rejected
 * those findings.
 *
 * Only managers and admins may access this endpoint.
 */
export async function GET(_req?: Request) {
  try {
    // 1️⃣ Auth – must be logged in
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthenticated', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // 2️⃣ Role check – managers and admins only
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Unable to determine user role', code: 'ROLE_UNKNOWN' },
        { status: 403 }
      );
    }

    if (!['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: managers and admins only', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 3️⃣ Pull all findings that reference a rule (source_id not null)
    let findingsQuery: any = supabaseAdmin
      .from('findings')
      .select('source_id,status');

    if (typeof findingsQuery.neq === 'function') {
      findingsQuery = findingsQuery.neq('source_id', null);
    }

    const { data: findings, error: findingsError } = await findingsQuery;

    if (findingsError) {
      console.error('[api/insights/gaps] Findings query error:', findingsError);
      return NextResponse.json(
        { error: 'Failed to fetch findings', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 4️⃣ Pull all brand rules – we need the rule text and category
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('brand_rules')
      .select('id,category,text');

    if (rulesError) {
      console.error('[api/insights/gaps] Rules query error:', rulesError);
      return NextResponse.json(
        { error: 'Failed to fetch brand rules', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 5️⃣ Calculate statistics and ranked list
    const gaps = calculateRuleGaps(rules ?? [], findings ?? []);

    return NextResponse.json({ gaps, rules: gaps }, { status: 200 });
  } catch (err: any) {
    console.error('[api/insights/gaps] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
