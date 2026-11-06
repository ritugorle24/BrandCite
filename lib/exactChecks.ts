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

function snippet(text: string, start: number, end: number): string {
  return text.slice(start, end);
}

export async function runExactChecks(
  text: string,
  terms: Term[],
  rules: Rule[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Banned terms
  const banned = terms.filter((t) => t.type === "banned");

  for (const term of banned) {
    // Trademark variants must match exact capitalization.
    const re = wordRegex(term.term);

    for (const match of text.matchAll(re)) {
      const start = match.index!;
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
    }
  }

  // 2. Detect incorrect usage of preferred terms
  for (const term of terms.filter((t) => t.type === "preferred")) {
    if (!term.replacement) continue;

    const re = wordRegex(term.term);

    for (const match of text.matchAll(re)) {
      findings.push({
        source_id: term.rule_id,
        issue: "non\u2011preferred term used",
        quote: match[0],
        severity: "medium",
        suggestion: term.replacement,
        confidence: 1,
        ai_assisted: false,
      });
    }
  }
  // 3. Unsupported absolute claims
  const claimWords = [
    "100%",
    "guaranteed",
    "best",
    "fastest",
    "risk-free",
    "risk-free",
    "always",
    "never",
  ];

  const claimRule = rules.find((r) =>
    r.category.toLowerCase().includes("claim")
  );

  const claimSourceId = claimRule?.id ?? null;

  for (const word of claimWords) {
    const re = wordRegex(word);

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

  return findings;
}