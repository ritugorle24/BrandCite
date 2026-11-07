import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '../rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows requests within the limit', () => {
    const res1 = checkRateLimit('test-client', 3, 1000);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit('test-client', 3, 1000);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit('test-client', 3, 1000);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks requests exceeding the limit', () => {
    checkRateLimit('spam-client', 2, 1000);
    checkRateLimit('spam-client', 2, 1000);

    const blocked = checkRateLimit('spam-client', 2, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it('isolates different clients', () => {
    checkRateLimit('client-a', 1, 1000);
    const blockedA = checkRateLimit('client-a', 1, 1000);
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit('client-b', 1, 1000);
    expect(allowedB.allowed).toBe(true);
  });
});

