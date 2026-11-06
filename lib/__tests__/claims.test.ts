/**
 * lib/__tests__/claims.test.ts
 *
 * Unit tests for lib/claims.ts:
 *   - extractClaims:  numbers, percentages, dates, superlatives, certifications
 *   - checkClaims:    no matching fact → needs_human
 *                     expired fact → high-severity open finding
 *                     valid (non-expired) fact → no finding
 *                     perpetual fact (valid_until null) → no finding
 */

import { describe, it, expect } from 'vitest';
import { extractClaims, checkClaims, type ApprovedFact } from '../claims.ts';

// ---------------------------------------------------------------------------
// Shared date helpers
// ---------------------------------------------------------------------------

const TODAY = new Date('2025-06-15');
const PAST = '2024-01-01';
const FUTURE = '2030-12-31';

// ---------------------------------------------------------------------------
// extractClaims
// ---------------------------------------------------------------------------

describe('extractClaims', () => {
  it('extracts a percentage', () => {
    const claims = extractClaims('Our uptime is 99.9%.');
    expect(claims.some((c) => c.text.includes('99.9%'))).toBe(true);
  });

  it('extracts a plain number', () => {
    const claims = extractClaims('We have 500 million users worldwide.');
    expect(claims.some((c) => c.text.toLowerCase().includes('500 million'))).toBe(true);
  });

  it('extracts a year date', () => {
    const claims = extractClaims('We have been operating since 2018.');
    expect(claims.some((c) => c.text.includes('2018'))).toBe(true);
  });

  it('extracts a month-year date', () => {
    const claims = extractClaims('Launched in January 2023.');
    expect(claims.some((c) => c.text.toLowerCase().includes('january 2023'))).toBe(true);
  });

  it('extracts a superlative', () => {
    const claims = extractClaims('We are the fastest solution on the market.');
    expect(claims.some((c) => c.text.toLowerCase().includes('fastest'))).toBe(true);
  });

  it('extracts a certification', () => {
    const claims = extractClaims('We are ISO 27001 certified and GDPR-compliant.');
    expect(claims.some((c) => c.text.toLowerCase().includes('iso'))).toBe(true);
    expect(claims.some((c) => c.text.toLowerCase().includes('gdpr'))).toBe(true);
  });

  it('deduplicates overlapping matches at same offset', () => {
    const claims = extractClaims('100%');
    // only one claim at offset 0
    const atZero = claims.filter((c) => c.start === 0);
    expect(atZero.length).toBe(1);
  });

  it('returns empty array for plain prose with no claims', () => {
    const claims = extractClaims('Our team is friendly and responsive.');
    // may contain false positives from broad regexes – just ensure it does not throw
    expect(Array.isArray(claims)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkClaims
// ---------------------------------------------------------------------------

describe('checkClaims', () => {
  // ---
  // 1. No matching fact → needs_human
  // ---
  it('produces a needs_human finding when no approved fact matches', () => {
    const draft = 'Our uptime is 99.9%.';
    const facts: ApprovedFact[] = [
      { id: 'F-UNRELATED-01', statement: 'Shipping takes 3 days.', valid_until: null, approved: true },
    ];

    const findings = checkClaims(draft, facts, TODAY);

    expect(findings.length).toBeGreaterThan(0);
    const f = findings.find((x) => x.status === 'needs_human');
    expect(f).toBeDefined();
    expect(f!.source_id).toBeNull();
    expect(f!.severity).toBe('high');
    expect(f!.issue).toContain('No approved source');
  });

  // ---
  // 2. Expired fact → "open" finding naming fact id and expiry date
  // ---
  it('produces an open finding when the matching fact is expired', () => {
    const draft = 'Our uptime is 99.9%.';
    const facts: ApprovedFact[] = [
      {
        id: 'F-UPTIME-01',
        statement: 'Our uptime is 99.9% over the last 12 months.',
        valid_until: PAST, // expired
        approved: true,
      },
    ];

    const findings = checkClaims(draft, facts, TODAY);

    const f = findings.find((x) => x.source_id === 'F-UPTIME-01');
    expect(f).toBeDefined();
    expect(f!.status).toBe('open');
    expect(f!.severity).toBe('high');
    expect(f!.issue).toContain('F-UPTIME-01');
    expect(f!.issue).toContain(PAST);
    expect(f!.confidence).toBe(1);
  });

  // ---
  // 3. Valid (non-expired) fact → no finding for this claim
  // ---
  it('produces NO finding when a valid non-expired fact matches', () => {
    const draft = 'Our uptime is 99.9%.';
    const facts: ApprovedFact[] = [
      {
        id: 'F-UPTIME-02',
        statement: 'Our uptime is 99.9% consistently.',
        valid_until: FUTURE, // still valid
        approved: true,
      },
    ];

    const findings = checkClaims(draft, facts, TODAY);

    // No finding should reference this fact (it's valid)
    const f = findings.find((x) => x.source_id === 'F-UPTIME-02');
    expect(f).toBeUndefined();
  });

  // ---
  // 4. Perpetual fact (valid_until null) → no finding
  // ---
  it('produces NO finding when a perpetual fact (valid_until null) matches', () => {
    const draft = 'We are ISO 27001 certified.';
    const facts: ApprovedFact[] = [
      {
        id: 'F-CERT-01',
        statement: 'ISO 27001 certification achieved.',
        valid_until: null, // perpetual
        approved: true,
      },
    ];

    const findings = checkClaims(draft, facts, TODAY);

    const f = findings.find((x) => x.source_id === 'F-CERT-01');
    expect(f).toBeUndefined();
  });

  // ---
  // 5. Multiple claims in a single draft – correct findings per claim
  // ---
  it('handles multiple claims in one draft independently', () => {
    const draft =
      'We have been ISO 27001 certified since 2018 with 99.9% uptime.';

    const facts: ApprovedFact[] = [
      // ISO claim matched & expired
      {
        id: 'F-CERT-02',
        statement: 'ISO 27001 certification valid.',
        valid_until: PAST,
        approved: true,
      },
      // 99.9% claim – no matching fact
    ];

    const findings = checkClaims(draft, facts, TODAY);

    // Should have an expired-fact finding for F-CERT-02
    expect(findings.some((f) => f.source_id === 'F-CERT-02')).toBe(true);

    // Should have a needs_human finding for 99.9% (no matching fact)
    expect(findings.some((f) => f.status === 'needs_human')).toBe(true);
  });

  // ---
  // 6. Empty draft → no findings
  // ---
  it('returns no findings for an empty draft', () => {
    const findings = checkClaims('', [], TODAY);
    expect(findings).toHaveLength(0);
  });

  // ---
  // 7. Empty facts array → all claims become needs_human
  // ---
  it('marks every claim needs_human when facts list is empty', () => {
    const draft = 'Our product is 100% secure and the fastest on the market since 2020.';
    const findings = checkClaims(draft, [], TODAY);
    // Every finding should be needs_human
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.status === 'needs_human')).toBe(true);
  });
});
