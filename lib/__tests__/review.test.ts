import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewDraft, ReviewFinding } from '../../lib/review.ts';

// ---------------------------------------------------------------------------
// Mock Supabase client – all three tables must resolve correctly
// ---------------------------------------------------------------------------
vi.mock('@supabase/supabase-js', () => {
  const makeTable = (rows: unknown[]) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
  });

  const mockFrom = (table: string) => {
    if (table === 'brand_rules') {
      return makeTable([
        { id: 'R-TEST-01', category: 'tone', text: 'Be friendly' },
        { id: 'R-CLAIM-01', category: 'claims', text: 'No unsubstantiated claims' },
      ]);
    }
    if (table === 'approved_facts') {
      return makeTable([
        { id: 'F-TEST-01', statement: 'Legal fact about security', valid_until: null, approved: true },
      ]);
    }
    if (table === 'terms') {
      return makeTable([
        { id: 'T-01', term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TEST-01' },
      ]);
    }
    return makeTable([]);
  };

  return { createClient: vi.fn(() => ({ from: mockFrom })) };
});

// ---------------------------------------------------------------------------
// Mock LLM client
// ---------------------------------------------------------------------------
vi.mock('../../lib/llm.ts', () => ({
  callLLM: vi.fn(),
  LLMUnavailableError: class LLMUnavailableError extends Error {
    constructor(p: string, f: string) { super(`${p}/${f}`); }
  },
}));

import { callLLM } from '../../lib/llm.ts';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('reviewDraft', () => {
  const draft = 'Our product is 100% secure and great.';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a finding with a valid fake source_id', async () => {
    (callLLM as any).mockResolvedValue({
      text: '[{"source_id":"R-TEST-01","issue":"test issue","quote":"100%","severity":"high","suggestion":null,"confidence":0.9}]',
    });
    const results = await reviewDraft(draft);
    const f = results.find((r) => r.source_id === 'R-TEST-01');
    expect(f).toBeDefined();
    expect(f?.status).toBe('open');
    expect(f?.ai_assisted).toBe(true);
  });

  it('handles invalid JSON by retrying', async () => {
    (callLLM as any)
      .mockResolvedValueOnce({ text: '```json\n[ { "source_id": "R-TEST-01", "issue": "bad" }' })
      .mockResolvedValueOnce({
        text: '[{"source_id":"R-TEST-01","issue":"fixed","quote":"secure","severity":"high","suggestion":null,"confidence":0.95}]',
      });
    const results = await reviewDraft(draft);
    const f = results.find((r) => r.issue === 'fixed');
    expect(f).toBeDefined();
    expect(f?.ai_assisted).toBe(true);
  });

  it('changes escalation when the confidence threshold changes', async () => {
    const { reviewConfig } = await import('../../lib/config.ts');

    (callLLM as any).mockResolvedValue({
      text: '[{"source_id":"R-TEST-01","issue":"threshold test","quote":"secure","severity":"high","suggestion":null,"confidence":0.4}]',
    });

    // At threshold 0.6, confidence 0.4 must be escalated.
    (reviewConfig as any).confidenceThreshold = 0.6;
    const highThresholdResults = await reviewDraft(draft);
    const highThresholdFinding = highThresholdResults.find(
      (r) => r.issue === 'threshold test'
    );
    expect(highThresholdFinding?.status).toBe('needs_human');

    // At threshold 0.3, confidence 0.4 must remain open.
    (reviewConfig as any).confidenceThreshold = 0.3;
    const lowThresholdResults = await reviewDraft(draft);
    const lowThresholdFinding = lowThresholdResults.find(
      (r) => r.issue === 'threshold test'
    );
    expect(lowThresholdFinding?.status).toBe('open');
  });

  it('falls back to exact findings when LLM is unavailable', async () => {
    const { LLMUnavailableError } = await import('../../lib/llm.ts');
    (callLLM as any).mockRejectedValue(new LLMUnavailableError('p', 'f'));
    const results = await reviewDraft(draft);
    const notice = results.find((r) => r.issue.includes('AI review unavailable'));
    expect(notice).toBeDefined();
    expect(notice?.ai_assisted).toBe(false);
  });
});
