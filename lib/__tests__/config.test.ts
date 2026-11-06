import { describe, it, expect } from 'vitest';
import { reviewConfig } from '../../lib/config.ts';

describe('lib/config', () => {
  it('exports a confidenceThreshold defaulting to 0.6', () => {
    expect(reviewConfig.confidenceThreshold).toBe(0.6);
  });

  it('confidenceThreshold is a number between 0 and 1', () => {
    expect(typeof reviewConfig.confidenceThreshold).toBe('number');
    expect(reviewConfig.confidenceThreshold).toBeGreaterThanOrEqual(0);
    expect(reviewConfig.confidenceThreshold).toBeLessThanOrEqual(1);
  });

  it('exports maxShortlistedRules as 12', () => {
    expect(reviewConfig.maxShortlistedRules).toBe(12);
  });

  it('exports maxShortlistedFacts as 8', () => {
    expect(reviewConfig.maxShortlistedFacts).toBe(8);
  });

  it('exports maxDraftLength as 5000', () => {
    expect(reviewConfig.maxDraftLength).toBe(5000);
  });
});
