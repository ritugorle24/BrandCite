
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/insights/gaps/route';

// Shared mock data
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// Mock authentication
vi.mock('../../lib/supabaseServer', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }),
}));

// Mock database
vi.mock('../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

const rules = [
  { id: 'R-1', category: 'tone', text: 'Rule One' },
  { id: 'R-2', category: 'claims', text: 'Rule Two' },
];

const findings = [
  { source_id: 'R-1', status: 'open' },
  { source_id: 'R-1', status: 'rejected' },
  { source_id: 'R-1', status: 'rejected' },
  { source_id: 'R-2', status: 'open' },
  { source_id: 'R-2', status: 'rejected' },
  { source_id: null, status: 'open' },
];

function setupMocks(
  findingsData = findings,
  rulesData = rules,
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'manager' },
          error: null,
        }),
      };
    }

    if (table === 'findings') {
      const chain: any = {};

      chain.select = vi.fn().mockReturnValue(chain);
      chain.neq = vi.fn().mockResolvedValue({
        data: findingsData,
        error: null,
      });

      return chain;
    }

    if (table === 'brand_rules') {
      return {
        select: vi.fn().mockResolvedValue({
          data: rulesData,
          error: null,
        }),
      };
    }

    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('GET /api/insights/gaps', () => {
  it('returns ranked rule stats with possibly_unclear flag', async () => {
    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(200);
    expect(json.gaps).toBeInstanceOf(Array);

    // R-1: 3 findings, 2 rejected, rejection rate 2/3
    expect(json.gaps[0].id).toBe('R-1');
    expect(json.gaps[0].flagged).toBe(3);
    expect(json.gaps[0].accepted).toBe(1);
    expect(json.gaps[0].rejected).toBe(2);
    expect(json.gaps[0].rejection_rate).toBeCloseTo(2 / 3);
    expect(json.gaps[0].possibly_unclear).toBe(true);

    // R-2: 2 findings, 1 rejected, rejection rate 1/2
    expect(json.gaps[1].id).toBe('R-2');
    expect(json.gaps[1].flagged).toBe(2);
    expect(json.gaps[1].accepted).toBe(1);
    expect(json.gaps[1].rejected).toBe(1);
    expect(json.gaps[1].rejection_rate).toBeCloseTo(0.5);
    expect(json.gaps[1].possibly_unclear).toBe(false);
  });

  it('returns an empty gaps list when the database has no rules or findings', async () => {
    setupMocks([], []);

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(200);
    expect(json.gaps).toEqual([]);
  });
});
