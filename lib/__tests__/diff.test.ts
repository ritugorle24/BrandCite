import { describe, it, expect } from 'vitest';
import { computeSimpleDiff } from '../diff';

describe('computeSimpleDiff', () => {
  it('returns equal token when texts are identical', () => {
    const diff = computeSimpleDiff('Hello world', 'Hello world');
    expect(diff.addedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
    expect(diff.tokens).toEqual([{ type: 'equal', value: 'Hello world' }]);
  });

  it('detects word additions', () => {
    const diff = computeSimpleDiff('Hello world', 'Hello brand new world');
    expect(diff.addedCount).toBeGreaterThan(0);
    const added = diff.tokens.find((t) => t.type === 'added');
    expect(added?.value).toContain('brand new');
  });

  it('detects word removals', () => {
    const diff = computeSimpleDiff('Try our guys blend', 'Try our blend');
    expect(diff.removedCount).toBeGreaterThan(0);
    const removed = diff.tokens.find((t) => t.type === 'removed');
    expect(removed?.value).toContain('guys');
  });

  it('handles empty strings', () => {
    const diff = computeSimpleDiff('', 'Hello');
    expect(diff.addedCount).toBe(1);
    expect(diff.tokens[0]).toEqual({ type: 'added', value: 'Hello' });
  });
});

