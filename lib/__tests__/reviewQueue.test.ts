import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for GET /api/review-queue and POST /api/findings/:id/resolve
 */

const mockUser = { id: 'user-mgr-001' };
const mockAdminUser = { id: 'user-admin-001' };
const mockCreatorUser = { id: 'user-creator-001' };

const profilesByUser: Record<string, { role: string }> = {
  'user-mgr-001': { role: 'manager' },
  'user-admin-001': { role: 'admin' },
  'user-creator-001': { role: 'creator' },
};

const mockFindings = [
  {
    id: 'f-001',
    draft_id: 'd-001',
    version_no: 1,
    source_id: null,
    issue: 'No source for 99.9%',
    quote: '99.9%',
    severity: 'high',
    suggestion: 'Add citation',
    confidence: 0.85,
    status: 'needs_human',
    escalation_reason: 'unmatched_claim',
    ai_assisted: false,
    created_at: '2026-11-01T00:00:00Z',
    drafts: { title: 'Q4 Launch Copy' },
  },
  {
    id: 'f-002',
    draft_id: 'd-002',
    version_no: 1,
    source_id: 'R-TEST-01',
    issue: 'Low confidence tone issue',
    quote: 'our product',
    severity: 'medium',
    suggestion: null,
    confidence: 0.35,
    status: 'needs_human',
    escalation_reason: 'low_confidence',
    ai_assisted: true,
    created_at: '2026-11-02T00:00:00Z',
    drafts: { title: 'Blog Post Draft' },
  },
];

let currentAuthUser: typeof mockUser | null = mockUser;
let findingsRows = structuredClone(mockFindings);

vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => {
        if (!currentAuthUser) {
          return {
            data: { user: null },
            error: { message: 'No session' },
          };
        }

        return {
          data: { user: currentAuthUser },
          error: null,
        };
      }),
    },
  })),
}));

vi.mock('@/lib/supabaseAdmin', () => {
  const createChain = (resolvedValue: any) => {
    const chain: any = {};
    const methods = ['select', 'eq', 'order', 'single', 'insert'];

    for (const m of methods) {
      chain[m] = vi.fn((..._args: any[]) => {
        if (m === 'single') {
          return Promise.resolve(resolvedValue);
        }
        return chain;
      });
    }

    chain[Symbol.for('resolveValue')] = resolvedValue;
    chain.order = vi.fn(() => Promise.resolve(resolvedValue));

    return chain;
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
      return createChain({
        data: profilesByUser[currentAuthUser?.id ?? ''] ?? null,
        error: currentAuthUser ? null : { message: 'not found' },
      });
    }

    if (table === 'findings') {
      const chain: any = {};
      let filterStatus: string | null = null;
      let filterId: string | null = null;

      chain.select = vi.fn(() => chain);

      chain.eq = vi.fn((_col: string, val: string) => {
        if (_col === 'status') filterStatus = val;
        if (_col === 'id') filterId = val;
        return chain;
      });

      chain.order = vi.fn(() => {
        const rows = findingsRows.filter(
          (f) => !filterStatus || f.status === filterStatus
        );

        return Promise.resolve({
          data: rows,
          error: null,
        });
      });

      chain.single = vi.fn(() => {
        const row = findingsRows.find((f) => f.id === filterId);

        return Promise.resolve({
          data: row ?? null,
          error: row ? null : { message: 'not found' },
        });
      });

      // Update mock: modifies the in-memory finding row.
      chain.update = vi.fn((_payload: any) => {
        const updChain: any = {};
        let updateId: string | null = null;

        updChain.eq = vi.fn((_col: string, val: string) => {
          if (_col === 'id') {
            updateId = val;
          }
          return updChain;
        });

        updChain.select = vi.fn(() => updChain);

        updChain.single = vi.fn(() => {
          const row = findingsRows.find((f) => f.id === updateId);

          if (!row) {
            return Promise.resolve({
              data: null,
              error: { message: 'not found' },
            });
          }

          Object.assign(row, _payload);

          return Promise.resolve({
            data: { ...row },
            error: null,
          });
        });

        return updChain;
      });

      return chain;
    }

    if (table === 'audit_log') {
      return {
        insert: vi.fn(async () => ({ error: null })),
      };
    }

    return createChain({
      data: null,
      error: null,
    });
  });

  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  };
});

// Import route handlers AFTER mocks
import { GET } from '../../app/api/review-queue/route';

import {
  POST as RESOLVE_POST,
} from '../../app/api/findings/[id]/resolve/route';

function makeReq(body: any): Request {
  return new Request(
    'http://localhost/api/findings/f-001/resolve',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
}

describe('GET /api/review-queue', () => {
  beforeEach(() => {
    currentAuthUser = mockUser;
    findingsRows = structuredClone(mockFindings);
  });

  it('returns 401 if unauthenticated', async () => {
    currentAuthUser = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 if user is a creator', async () => {
    currentAuthUser = mockCreatorUser;
    const res = await GET();

    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toMatch(/managers and admins only/i);
  });

  it('returns the queue for a manager', async () => {
    currentAuthUser = mockUser;
    const res = await GET();

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.queue).toBeDefined();
    expect(Array.isArray(json.queue)).toBe(true);
    expect(json.queue.length).toBe(2);

    const item = json.queue[0];

    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('draft_title');
    expect(item).toHaveProperty('quote');
    expect(item).toHaveProperty('escalation_reason');
  });

  it('returns the queue for an admin', async () => {
    currentAuthUser = mockAdminUser;
    const res = await GET();

    expect(res.status).toBe(200);
  });

  it('queue items include draft_title from joined drafts', async () => {
    const res = await GET();
    const { queue } = await res.json();

    expect(queue[0].draft_title).toBe('Q4 Launch Copy');
    expect(queue[1].draft_title).toBe('Blog Post Draft');
  });

  it('queue items include escalation_reason', async () => {
    const res = await GET();
    const { queue } = await res.json();

    expect(queue[0].escalation_reason).toBe('unmatched_claim');
    expect(queue[1].escalation_reason).toBe('low_confidence');
  });
});

describe('POST /api/findings/:id/resolve', () => {
  beforeEach(() => {
    currentAuthUser = mockUser;
    findingsRows = structuredClone(mockFindings);
  });

  const makeParams = (id: string) => Promise.resolve({ id });

  it('returns 401 if unauthenticated', async () => {
    currentAuthUser = null;

    const res = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(401);
  });

  it('returns 403 if user is a creator', async () => {
    currentAuthUser = mockCreatorUser;

    const res = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid decision', async () => {
    const res = await RESOLVE_POST(
      makeReq({ decision: 'maybe' }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/confirmed.*dismissed/i);
  });

  it('returns 400 for missing decision', async () => {
    const res = await RESOLVE_POST(
      makeReq({}),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent finding', async () => {
    const res = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-999') }
    );

    expect(res.status).toBe(404);
  });

  it('returns 409 if finding is not in needs_human status', async () => {
    findingsRows = findingsRows.map((f) =>
      f.id === 'f-001'
        ? { ...f, status: 'open' }
        : f
    );

    const res = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(409);
  });

  it('removes a confirmed finding from the review queue', async () => {
    const resolveRes = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-001') }
    );

    expect(resolveRes.status).toBe(200);

    const queueRes = await GET();
    const json = await queueRes.json();

    expect(queueRes.status).toBe(200);
    expect(json.queue.some((f: any) => f.id === 'f-001')).toBe(false);
    expect(json.queue.some((f: any) => f.id === 'f-002')).toBe(true);
  });

  it('removes a dismissed finding from the review queue', async () => {
    const resolveRes = await RESOLVE_POST(
      makeReq({ decision: 'dismissed' }),
      { params: makeParams('f-001') }
    );

    expect(resolveRes.status).toBe(200);

    const queueRes = await GET();
    const json = await queueRes.json();

    expect(queueRes.status).toBe(200);
    expect(json.queue.some((f: any) => f.id === 'f-001')).toBe(false);
    expect(json.queue.some((f: any) => f.id === 'f-002')).toBe(true);
  });

  it('dismisses a finding (sets status to rejected)', async () => {
    const res = await RESOLVE_POST(
      makeReq({
        decision: 'dismissed',
        note: 'False positive',
      }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.message).toMatch(/dismissed/i);
    expect(json.finding.status).toBe('rejected');
  });

  it('works without a note', async () => {
    const res = await RESOLVE_POST(
      makeReq({ decision: 'confirmed' }),
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.finding.resolution_note).toBeNull();
  });

  it('returns 400 for non-JSON body', async () => {
    const badReq = new Request('http://localhost', {
      method: 'POST',
      body: 'not json',
    });

    const res = await RESOLVE_POST(
      badReq,
      { params: makeParams('f-001') }
    );

    expect(res.status).toBe(400);
  });
});