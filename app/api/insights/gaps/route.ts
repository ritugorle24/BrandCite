import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/insights/gaps
 *
 * Returns a ranked list of brand rules with statistics about how often they
 * have been flagged by the review system and how often reviewers have rejected
 * those findings.
 *
 * Only managers and admins may access this endpoint.
 */
export async function GET() {
  // 1️⃣ Auth – must be logged in
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // 2️⃣ Role check – managers and admins only
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

  // 3️⃣ Pull all findings that reference a rule (source_id not null)
  const { data: findings, error: findingsError } = await supabaseAdmin
    .from('findings')
    .select('source_id,status')
    .neq('source_id', null);

  if (findingsError) {
    console.error('[api/insights/gaps] Findings query error:', findingsError);
    return NextResponse.json(
      { error: 'Failed to fetch findings' },
      { status: 500 }
    );
  }

  // 4️⃣ Pull all brand rules – we need the rule text for the UI
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('brand_rules')
    .select('id,category,text');

  if (rulesError) {
    console.error('[api/insights/gaps] Rules query error:', rulesError);
    return NextResponse.json(
      { error: 'Failed to fetch brand rules' },
      { status: 500 }
    );
  }

  // 5️⃣ Aggregate statistics per rule
  const ruleStats = new Map<string, {
    id: string;
    category: string;
    text: string;
    flagged: number;
    accepted: number;
    rejected: number;
  }>();

  for (const r of rules ?? []) {
    ruleStats.set(r.id, {
      id: r.id,
      category: r.category,
      text: r.text,
      flagged: 0,
      accepted: 0,
      rejected: 0,
    });
  }

  for (const f of findings ?? []) {
    const src = f.source_id as string | null;
    if (!src) continue;
    const entry = ruleStats.get(src);
    if (!entry) continue; // source_id not a rule (could be a fact)
    entry.flagged += 1;
    if (f.status === 'open') entry.accepted += 1;
    else if (f.status === 'rejected') entry.rejected += 1;
  }

  // 6️⃣ Build the response list, calculate rejection rate and unclear flag
  const gaps = Array.from(ruleStats.values())
    .filter((r) => r.flagged > 0)
    .map((r) => {
      const rejectionRate = r.flagged ? r.rejected / r.flagged : 0;
      const possiblyUnclear = r.flagged >= 3 && rejectionRate >= 0.5;
      return {
        id: r.id,
        category: r.category,
        text: r.text,
        flagged: r.flagged,
        accepted: r.accepted,
        rejected: r.rejected,
        rejection_rate: rejectionRate,
        possibly_unclear: possiblyUnclear,
      };
    })
    .sort((a, b) => {
      // primary: highest rejection rate, secondary: most flagged
      if (b.rejection_rate !== a.rejection_rate) {
        return b.rejection_rate - a.rejection_rate;
      }
      return b.flagged - a.flagged;
    });

  return NextResponse.json({ gaps }, { status: 200 });
}
