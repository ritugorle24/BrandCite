import { describe, it, expect } from 'vitest';
import { runExactChecks, Term, Rule, Finding } from '../../lib/exactChecks';

// Helper to build minimal term / rule arrays
function makeTerm(overrides: Partial<Term> = {}): Term {
  return {
    id: 'uuid',
    term: 'placeholder',
    type: 'banned',
    replacement: undefined,
    rule_id: 'R-TEST-01',
    ...overrides,
  } as Term;
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'R-CLAIM-01',
    category: 'claims',
    text: 'some claim rule',
    ...overrides,
  } as Rule;
}

describe('runExactChecks – exact validation suite', () => {
  // 1. Banned term detection (case‑insensitive)
  it('detects banned terms regardless of case', async () => {
    const text = 'The manager said: GUYS, listen.';
    const terms: Term[] = [
      makeTerm({ term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-01' }),
    ];
    const findings = await runExactChecks(text, terms, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].source_id).toBe('R-TERM-01');
    expect(findings[0].issue).toBe('banned term used');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].quote.toLowerCase()).toContain('guys');
  });

  // 2. Banned term should NOT fire inside other words
  it('does not flag banned term when part of another word', async () => {
    const text = 'He is the bestow of the team.';
    const terms: Term[] = [
      makeTerm({ term: 'best', type: 'banned', replacement: undefined, rule_id: 'R-TERM-02' }),
    ];
    const findings = await runExactChecks(text, terms, []);
    expect(findings).toHaveLength(0);
  });

  // 3. Preferred term used incorrectly (non‑preferred term)
  it('flags non‑preferred term usage and suggests replacement', async () => {
    const text = 'Our brand is called Nova Brew.';
    const terms: Term[] = [
      makeTerm({
        term: 'Nova Brew',
        type: 'preferred',
        replacement: 'NovaBrew',
        rule_id: 'R-TERM-03',
      }),
    ];
    const findings = await runExactChecks(text, terms, []);
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.source_id).toBe('R-TERM-03');
    expect(f.issue).toBe('non‑preferred term used');
    expect(f.severity).toBe('medium');
    expect(f.suggestion).toBe('NovaBrew');
  });

  // 4. Preferred term should not be flagged when the correct term appears
  it('does not flag when the correct preferred term is used', async () => {
    const text = 'Our brand is called NovaBrew.';
    const terms: Term[] = [
      makeTerm({
        term: 'Nova Brew',
        type: 'preferred',
        replacement: 'NovaBrew',
        rule_id: 'R-TERM-04',
      }),
    ];
    const findings = await runExactChecks(text, terms, []);
    expect(findings).toHaveLength(0);
  });

  // 5. Unsupported claim word detection (case‑insensitive)
  it('detects unsupported claim words like "best"', async () => {
    const text = 'This is the best coffee you will ever taste.';
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-99', category: 'claims' })];
    const findings = await runExactChecks(text, [], rules);
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.source_id).toBe('R-CLAIM-99');
    expect(f.issue).toBe('unsupported absolute claim');
    expect(f.severity).toBe('high');
    expect(f.quote.toLowerCase()).toContain('best');
  });

  // 6. Claim word should not trigger inside other words (e.g., "bestow")
  it('does not flag claim words inside other words', async () => {
    const text = 'He will bestow the award tomorrow.';
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-01', category: 'claims' })];
    const findings = await runExactChecks(text, [], rules);
    expect(findings).toHaveLength(0);
  });

  // 7. Multiple different matches in one text
  it('captures multiple findings of different types', async () => {
    const text = 'Our product is 100% guaranteed and never fails. Guys, check it.';
    const terms: Term[] = [
      makeTerm({ term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-05' }),
    ];
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-02', category: 'claims' })];
    const findings = await runExactChecks(text, terms, rules);
    // Expect three findings: 100%, guaranteed, never, plus banned term = 4 total
    expect(findings).toHaveLength(4);
    const issues = findings.map((f) => f.issue).sort();
    expect(issues).toEqual([
      'banned term used',
      'unsupported absolute claim',
      'unsupported absolute claim',
      'unsupported absolute claim',
    ]);
  });

  // 8. Empty result when nothing matches
  it('returns empty array when no patterns are found', async () => {
    const text = 'Plain neutral description with no special words.';
    const findings = await runExactChecks(text, [], []);
    expect(findings).toHaveLength(0);
  });

  // 9. Claim detection is case‑insensitive
  it('detects claim words regardless of case', async () => {
    const text = 'THIS IS ALWAYS THE FASTEST SOLUTION.';
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-03', category: 'claims' })];
    const findings = await runExactChecks(text, [], rules);
    expect(findings).toHaveLength(2); // ALWAYS and FASTEST
    const lowerQuotes = findings.map((f) => f.quote.toLowerCase());
    expect(lowerQuotes).toContain('always');
    expect(lowerQuotes).toContain('fastest');
  });

  // 10. When no claim rule exists, source_id should be null
  it('uses null source_id when no claim rule is supplied', async () => {
    const text = 'Our product is the best.';
    const findings = await runExactChecks(text, [], []);
    expect(findings).toHaveLength(1);
    expect(findings[0].source_id).toBeNull();
  });

  // 11. All findings have confidence 1 and ai_assisted false
  it('sets confidence to 1 and ai_assisted to false for all findings', async () => {
    const text = 'guys best 100%';
    const terms: Term[] = [
      makeTerm({ term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-06' }),
    ];
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-04', category: 'claims' })];
    const findings = await runExactChecks(text, terms, rules);
    expect(findings).toHaveLength(3);
    for (const f of findings) {
      expect(f.confidence).toBe(1);
      expect(f.ai_assisted).toBe(false);
    }
  });

  // 12. Severity mapping verification
  it('assigns correct severity levels', async () => {
    const text = 'guys best';
    const terms: Term[] = [
      makeTerm({ term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-07' }),
    ];
    const rules: Rule[] = [makeRule({ id: 'R-CLAIM-05', category: 'claims' })];
    const findings = await runExactChecks(text, terms, rules);
    const severityMap = findings.reduce((acc, f) => {
      acc[f.issue] = f.severity;
      return acc;
    }, {} as Record<string, string>);
    expect(severityMap['banned term used']).toBe('high');
    expect(severityMap['unsupported absolute claim']).toBe('high');
  });
});
