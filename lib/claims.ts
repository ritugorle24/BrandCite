/**
 * lib/claims.ts
 *
 * Extracts factual claims from draft text, matches each against approved facts,
 * and returns findings for:
 *   - expired facts  (valid_until is in the past)
 *   - unverified claims with no approved source → needs_human
 */

import type { ReviewFinding } from './review.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovedFact {
  id: string;
  statement: string;
  valid_until: string | null; // ISO date string e.g. "2025-12-31" or null
  approved: boolean;
}

export interface ExtractedClaim {
  text: string;    // the verbatim snippet from the draft
  start: number;   // character offset
}

// ---------------------------------------------------------------------------
// Claim-extraction regexes (ordered by specificity)
// ---------------------------------------------------------------------------

const CLAIM_PATTERNS: RegExp[] = [
  // Percentages:   "99.9%", "50 %"
  /\b\d+(?:\.\d+)?\s*%/giu,

  // Plain numbers with optional units: "500 million", "1,200 users", "3 years"
  /\b\d[\d,]*(?:\.\d+)?\s*(?:million|billion|thousand|k|years?|months?|days?|hours?|minutes?|seconds?|users?|customers?|products?|countries?|languages?)?\b/giu,

  // Dates: "January 2024", "2024-01-15", "Q1 2025", "since 2020"
  /\b(?:since\s+)?\d{4}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b|\bQ[1-4]\s+\d{4}\b/giu,

  // Superlatives
  /\b(?:the\s+)?(?:best|fastest|cheapest|most\s+\w+|largest|smallest|leading|top[- ]\w*|#1|number\s*one)\b/giu,

  // Certifications / compliance marks
  /\b(?:ISO\s*\d+(?::\d+)?|GDPR[- ]compliant|HIPAA[- ]compliant|SOC\s*[12]|PCI[-\s]DSS|FIPS[-\s]\d+|CE[-\s]certified|FDA[- ]approved|CCPA[- ]compliant)\b/giu,
];

// ---------------------------------------------------------------------------
// Extract claims from draft text
// ---------------------------------------------------------------------------

export function extractClaims(draft: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seen = new Set<number>(); // dedupe by start offset

  for (const re of CLAIM_PATTERNS) {
    re.lastIndex = 0; // reset stateful regex
    for (const match of draft.matchAll(re)) {
      const start = match.index!;
      if (!seen.has(start)) {
        seen.add(start);
        claims.push({ text: match[0].trim(), start });
      }
    }
  }

  return claims.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// Simple relevance scorer: does the fact statement mention the claim text?
// ---------------------------------------------------------------------------

function claimMatchesFact(claim: ExtractedClaim, fact: ApprovedFact): boolean {
  const claimLower = claim.text.toLowerCase().replace(/\s+/g, ' ');
  const factLower = fact.statement.toLowerCase();
  // Check if any word from the claim appears in the fact statement
  const words = claimLower.split(/\s+/).filter((w) => w.length > 2);
  return words.some((w) => factLower.includes(w));
}

// ---------------------------------------------------------------------------
// Main checker: returns ReviewFindings for claims that fail verification
// ---------------------------------------------------------------------------

export function checkClaims(
  draft: string,
  approvedFacts: ApprovedFact[],
  today: Date = new Date()
): ReviewFinding[] {
  const claims = extractClaims(draft);
  const findings: ReviewFinding[] = [];

  for (const claim of claims) {
    // Find all facts that mention this claim
    const candidates = approvedFacts.filter((f) => claimMatchesFact(claim, f));

    if (candidates.length === 0) {
      // No approved source exists for this claim
      findings.push({
        source_id: null,
        issue: `No approved source supports the claim: "${claim.text}"`,
        quote: claim.text,
        severity: 'high',
        suggestion: 'Add a citation to an approved fact or remove this claim.',
        confidence: 0.85,
        ai_assisted: false,
        status: 'needs_human',
      });
      continue;
    }

    // Check each matching fact for expiry
    const todayMidnight = new Date(today.toISOString().slice(0, 10));
    for (const fact of candidates) {
      if (fact.valid_until !== null) {
        const expiry = new Date(fact.valid_until);
        if (expiry < todayMidnight) {
          findings.push({
            source_id: fact.id,
            issue: `Claim "${claim.text}" is supported only by an expired fact (${fact.id}, expired ${fact.valid_until}).`,
            quote: claim.text,
            severity: 'high',
            suggestion: `Renew or replace fact ${fact.id} before publishing.`,
            confidence: 1,
            ai_assisted: false,
            status: 'open',
          });
        }
        // If valid fact found (non-expired) we produce no finding (claim verified).
      }
      // null valid_until = perpetual, never expires → claim is verified, no finding.
    }
  }

  return findings;
}
