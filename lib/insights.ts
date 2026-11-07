export interface BrandRuleItem {
  id: string;
  category: string;
  text: string;
}

export interface FindingItem {
  source_id: string | null;
  status: string;
}

export interface RuleGapInsight {
  id: string;
  category: string;
  text: string;
  flagged: number;
  times_flagged: number;
  timesFlagged: number;
  accepted: number;
  times_accepted: number;
  timesAccepted: number;
  rejected: number;
  times_rejected: number;
  timesRejected: number;
  rejection_rate: number;
  rejectionRate: number;
  possibly_unclear: boolean;
  possiblyUnclear: boolean;
}

export interface CalculateGapsOptions {
  includeUnflagged?: boolean;
}

/**
 * Calculates guideline gap statistics for brand rules based on review findings.
 *
 * For each rule:
 * - times flagged: count of findings referencing this rule
 * - times accepted: count of findings accepted (or open pending accept)
 * - times rejected: count of findings rejected
 * - rejection rate: times rejected / times flagged (0 if unflagged)
 * - possibly unclear: flagged >= 3 times and rejected >= 50% of the time (rejection_rate >= 0.5)
 *
 * Returns a ranked list sorted primarily by rejection rate descending,
 * secondarily by times flagged descending, and tertiarily by rule id ascending.
 */
export function calculateRuleGaps(
  rules: BrandRuleItem[],
  findings: FindingItem[],
  options: CalculateGapsOptions = {}
): RuleGapInsight[] {
  const ruleStats = new Map<
    string,
    {
      id: string;
      category: string;
      text: string;
      flagged: number;
      accepted: number;
      rejected: number;
    }
  >();

  for (const r of rules) {
    ruleStats.set(r.id, {
      id: r.id,
      category: r.category,
      text: r.text,
      flagged: 0,
      accepted: 0,
      rejected: 0,
    });
  }

  for (const f of findings) {
    const src = f.source_id as string | null;
    if (!src) continue;
    const entry = ruleStats.get(src);
    if (!entry) continue; // source_id not a rule (could be a fact)

    entry.flagged += 1;
    if (f.status === 'accepted' || f.status === 'open') {
      entry.accepted += 1;
    } else if (f.status === 'rejected') {
      entry.rejected += 1;
    }
  }

  const list = Array.from(ruleStats.values());
  const filtered = options.includeUnflagged
    ? list
    : list.filter((r) => r.flagged > 0);

  return filtered
    .map((r) => {
      const rejectionRate = r.flagged > 0 ? r.rejected / r.flagged : 0;
      const possiblyUnclear = r.flagged >= 3 && rejectionRate >= 0.5;

      return {
        id: r.id,
        category: r.category,
        text: r.text,
        flagged: r.flagged,
        times_flagged: r.flagged,
        timesFlagged: r.flagged,
        accepted: r.accepted,
        times_accepted: r.accepted,
        timesAccepted: r.accepted,
        rejected: r.rejected,
        times_rejected: r.rejected,
        timesRejected: r.rejected,
        rejection_rate: rejectionRate,
        rejectionRate: rejectionRate,
        possibly_unclear: possiblyUnclear,
        possiblyUnclear: possiblyUnclear,
      };
    })
    .sort((a, b) => {
      // primary: highest rejection rate descending
      if (b.rejection_rate !== a.rejection_rate) {
        return b.rejection_rate - a.rejection_rate;
      }
      // secondary: most flagged descending
      if (b.flagged !== a.flagged) {
        return b.flagged - a.flagged;
      }
      // tertiary: stable order by rule id
      return a.id.localeCompare(b.id);
    });
}

