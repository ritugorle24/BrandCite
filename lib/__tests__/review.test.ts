import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewDraft, ReviewFinding } from '../../lib/review.ts';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  const mockFrom = (table: string) => {
    if (table === 'brand_rules') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'R-TEST-01', category: 'tone', text: 'Be friendly' }], error: null }),
      };
    }
    if (table === 'approved_facts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'F-TEST-01', category: 'legal', fact_text: 'Legal fact' }], error: null }),
      };
    }
    return { select: vi.fn(), eq: vi.fn() };
  };
  return { createClient: vi.fn(() => ({ from: mockFrom })) };
});

// Mock LLM client
vi.mock('../../lib/llm.ts', () => {
  return {
    callLLM: vi.fn(),
    LLMUnavailableError: class extends Error {},
  };
});

import { callLLM } from '../../lib/llm.ts';

describe('reviewDraft', () => {
  const draft = 'Our product is 100% secure and great.';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a finding with a valid fake source_id', async () => {
    (callLLM as any).mockResolvedValue({ text: '[{"source_id":"R-TEST-01","issue":"test issue","quote":"100%","severity":"high","suggestion":null,"confidence":0.9}]' });
    const results = await reviewDraft(draft);
    const f = results.find((r) => r.source_id === 'R-TEST-01');
    expect(f).toBeDefined();
    expect(f?.status).toBe('open');
    expect(f?.ai_assisted).toBe(true);
  });

  it('handles invalid JSON by retrying', async () => {
    // First response malformed, second correct
    (callLLM as any)
      .mockResolvedValueOnce({ text: '```json\n[ { "source_id": "R-TEST-01", "issue": "bad" }' }) // missing closing ] and }
      .mockResolvedValueOnce({ text: '[{"source_id":"R-TEST-01","issue":"fixed","quote":"secure","severity":"high","suggestion":null,"confidence":0.95}]' });
    const results = await reviewDraft(draft);
    const f = results.find((r) => r.issue === 'fixed');
    expect(f).toBeDefined();
    expect(f?.ai_assisted).toBe(true);
  });

  it('marks low confidence findings as needs_human', async () => {
    (callLLM as any).mockResolvedValue({ text: '[{"source_id":"R-TEST-01","issue":"low confidence","quote":"secure","severity":"high","suggestion":null,"confidence":0.4}]' });
    const results = await reviewDraft(draft);
    const f = results.find((r) => r.issue === 'low confidence');
    expect(f?.status).toBe('needs_human');
  });

  it('falls back to exact findings when LLM is unavailable', async () => {
    const { LLMUnavailableError } = await import('../../lib/llm.ts');
    (callLLM as any).mockRejectedValue(new LLMUnavailableError('p', 'f'));
    const results = await reviewDraft(draft);
    // Should contain the AI-unavailable notice
    const notice = results.find((r) => r.issue.includes('AI review unavailable'));
    expect(notice).toBeDefined();
    expect(notice?.ai_assisted).toBe(false);
  });
});
