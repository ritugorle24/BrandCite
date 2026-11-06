export interface Term {
  id: string;
  term: string;
  type: "preferred" | "banned";
  replacement?: string;
  rule_id: string;
}

export interface Rule {
  id: string;
  category: string;
  text: string;
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRegex(term: string, caseSensitive = false): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegExp(term)}(?![\\p{L}\\p{N}_])`,
    caseSensitive ? "gu" : "giu"
  );
}

export async function runExactChecks(
  text: string,
  terms: Term[],
  rules: Rule[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Detect banned terms
  for (const term of terms.filter((t) => t.type === "banned")) {
    // Preserve correct trademark capitalization.
    const caseSensitive = term.rule_id === "R-TERM-01";
    const re = wordRegex(term.term, caseSensitive);

    for (const match of text.matchAll(re)) {
      const start = match.index!;
      findings.push({
        source_id: term.rule_id,
        issue: "banned term used",
        quote: text.slice(start, start + match[0].length),
        severity: "high",
        suggestion: term.replacement ?? "",
        confidence: 1,
        ai_assisted: false,
      });
    }
  }

  // 2. Preferred terms are approved vocabulary, not violations.

  // 3. Detect unsupported absolute claims
  const claimPatterns = [
    /(?<![\p{L}\p{N}_])100%(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])guaranteed(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])best(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])fastest(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])risk[-\u2010-\u2015]free(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])always(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])never(?![\p{L}\p{N}_])/giu,
  ];

  const claimRule = rules.find((r) =>
    r.category.toLowerCase().includes("claim")
  );

  for (const re of claimPatterns) {
    for (const match of text.matchAll(re)) {
      const start = match.index!;

      findings.push({
        source_id: claimRule?.id ?? null,
        issue: "unsupported absolute claim",
        quote: match[0],
        severity: "high",
        suggestion: "remove or qualify the claim",
        confidence: 1,
        ai_assisted: false,
      });
    }
  }

  return findings;
}
