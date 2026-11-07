import { SupabaseClient } from '@supabase/supabase-js';

export interface AdminRule {
  id: string;
  category: string;
  text: string;
  severity: 'low' | 'medium' | 'high';
  approved: boolean;
  approved_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AdminFact {
  id: string;
  statement: string;
  source_note?: string | null;
  valid_until?: string | null;
  approved: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminTerm {
  id: string;
  term: string;
  type: 'preferred' | 'banned';
  replacement?: string | null;
  rule_id?: string | null;
  approved: boolean;
  created_at?: string;
}

/**
 * Returns a short, actionable, plain-language note explaining the review metrics
 * for a brand rule.
 */
export function generatePlainLanguageRuleNote(rule: {
  flagged: number;
  accepted: number;
  rejected: number;
  rejection_rate: number;
  possibly_unclear: boolean;
}): string {
  if (rule.flagged === 0) {
    return 'No violations flagged yet. Guideline is either followed closely or rarely encountered in everyday copy.';
  }

  const rejPercent = Math.round(rule.rejection_rate * 100);
  const accPercent = Math.round((rule.accepted / rule.flagged) * 100);

  if (rule.possibly_unclear) {
    return `Overturned ${rejPercent}% of the time across ${rule.flagged} review flags. Reviewers frequently disagree with this rule, suggesting the wording is ambiguous, too broad, or counter to brand tone. Consider clarifying or simplifying.`;
  }

  if (rule.flagged >= 3 && accPercent >= 70) {
    return `Consistently accepted by reviewers (${accPercent}% accept rate). This guideline is clear, well-understood, and effectively catches brand non-compliance.`;
  }

  if (rule.flagged < 3) {
    return `Low review volume (${rule.flagged} flag${rule.flagged === 1 ? '' : 's'}). Monitor more drafts before drawing conclusions on clarity.`;
  }

  return `Moderately accepted (${accPercent}% accept rate, ${rejPercent}% rejected). Reviewers occasionally overturn this finding; check context examples in style guide.`;
}

/**
 * Loads unapproved term IDs using audit_log events as an override or state record.
 */
export async function getUnapprovedTermIds(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('entity_id, action, created_at')
      .eq('entity_type', 'term')
      .order('created_at', { ascending: true });

    if (error || !data) {
      return new Set();
    }

    const unapproved = new Set<string>();
    for (const record of data) {
      if (record.action === 'term.unapproved') {
        unapproved.add(record.entity_id);
      } else if (record.action === 'term.approved') {
        unapproved.delete(record.entity_id);
      }
    }
    return unapproved;
  } catch {
    return new Set();
  }
}

/**
 * Records a term approval status toggle in audit_log.
 */
export async function recordTermApprovalStatus(
  supabase: SupabaseClient,
  termId: string,
  approved: boolean,
  actorId?: string | null
): Promise<void> {
  await supabase.from('audit_log').insert({
    actor_id: actorId ?? null,
    action: approved ? 'term.approved' : 'term.unapproved',
    entity_type: 'term',
    entity_id: termId,
    payload: { approved, toggled_at: new Date().toISOString() },
  });
}

