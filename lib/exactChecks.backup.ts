/**
 * Exact checks – rule‑based static analysis of a draft.
 *
 * The function scans the supplied `text` for:
 *   • Banned terms (case‑insensitive, whole‑word only).
 *   • Non‑preferred terms that have a defined `replacement`.
 *   • Unsupported absolute‑claim words (e.g. "best", "100%", "never").
 *
 * Each detection yields a finding object that matches the DB schema:
 *   {
 *     source_id: string | null,   // rule id that triggered the finding
 *     issue: string,              // short description of the problem
 *     quote: string,              // snippet from the original text
 *     severity: string,           // "high" or "medium"
 *     suggestion: string,         // recommended fix (may be empty)
 *     confidence: 1,
 *     ai_assisted: false
 *   }
 */

// ─── Types ───────────────────────────────────────────────────────
export interface Term {
  id: string; // primary key (uuid) – not used for matching
  term: string; // the literal term to look for
  type: "preferred" | "banned";
  replacement?: string; // for preferred terms, the correct wording
  rule_id: string; // the rule that governs this term
}

export interface Rule {
  id: string; // e.g. R-CLAI-01, R-TERM-01, etc.
  category: string; // "tone" | "terminology" | "claims" | "accessibility"
  text: string; // rule body (not needed for matching)
}

export interface Finding {
  source_id: string | null;
  issue: string;
  quote: string;
  severity: string;
  suggestion: string;
  confidence: number;
  ai_assisted: boolean;
}

// ─── Helper regex utilities ─────────────────────────────────────
/** Escape RegExp special characters in a literal string */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Return a case‑insensitive whole‑word regex for a term */
function wordRegex(term: string): RegExp {
  // Global, case‑insensitive regex to allow exec() to advance via lastIndex
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
}

/** Trim a snippet to a reasonable length, preserving the match */
function snippet(text: string, start: number, end: number, max = 100): string {
  const raw = text.slice(start, end);
  if (raw.length <= max) return raw;
  // keep the matched part centred
  const half = Math.floor(max / 2);
  const mid = Math.floor((start + end) / 2);
  const left = Math.max(0, mid - half);
  const right = Math.min(text.length, left + max);
  return text.slice(left, right);
}

// ─── Core function ───────────────────────────────────────────────
/**
 * Run exact checks on a draft.
 * @param text  The draft text to analyse.
 * @param terms Array of term records (both banned and preferred).
 * @param rules Array of rule records – used to resolve claim‑word matches.
 * @returns Array of findings.
 */
export async function runExactChecks(
  text: string,
  terms: Term[],
  rules: Rule[]
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const lowered = text; // keep original for quoting, regexes are case‑insensitive.

  // ---- 1. Banned terms -------------------------------------------------
  const banned = terms.filter((t) => t.type === "banned");
  for (const term of banned) {
    const re = wordRegex(term.term);
    let match: RegExpExecArray | null;
    while ((match = re.exec(lowered)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      findings.push({
        source_id: term.rule_id,
        issue: "banned term used",
        quote: snippet(text, start, end),
        severity: "high",
        suggestion: term.replacement ?? "",
        confidence: 1,
        ai_assisted: false,
      });
      // move past this match to avoid infinite loops
      re.lastIndex = end;
    }
  }

  // ---- 2. Preferred terms used incorrectly ---------------------------
  const preferred = terms.filter((t) => t.type === "preferred" && t.replacement);
  for (const term of preferred) {
    const re = wordRegex(term.term);
    let match: RegExpExecArray | null;
    while ((match = re.exec(lowered)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      findings.push({
        source_id: term.rule_id,
        issue: "non‑preferred term used",
        quote: snippet(text, start, end),
        severity: "medium",
        suggestion: term.replacement!,
        confidence: 1,
        ai_assisted: false,
      });
      re.lastIndex = end;
    }
  }

  // ---- 3. Unsupported absolute‑claim words ---------------------------
  const claimWords = [
    "100%",
    "guaranteed",
    "best",
    "number one",
    "fastest",
    "risk‑free",
    "always",
    "never",
  ];

  // Find a generic claim rule – first rule whose category includes "claims"
  const claimRule = rules.find((r) => r.category.toLowerCase().includes("claim"));
  const claimSourceId = claimRule ? claimRule.id : null;

    for (const word of claimWords) {
      const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
      for (const match of text.matchAll(re)) {
        const start = match.index!;
        const end = start + match[0].length;
        findings.push({
          source_id: claimSourceId,
          issue: "unsupported absolute claim",
          quote: snippet(text, start, end),
          severity: "high",
          suggestion: "remove or qualify the claim",
          confidence: 1,
          ai_assisted: false,
        });
      }
    }

  // DEBUG – temporary logging
  
  return findings;
}
