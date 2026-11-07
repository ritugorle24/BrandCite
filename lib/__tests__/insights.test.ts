import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/insights/gaps/route';
import { calculateRuleGaps, BrandRuleItem, FindingItem } from '../../lib/insights';

// Shared mock data
const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

// Mock authentication
vi.mock('../../lib/supabaseServer', () => ({
  createSupabaseServerClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    })
  ),
}));

// Mock database
vi.mock('../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

const rules: BrandRuleItem[] = [
  { id: 'R-1', category: 'tone', text: 'Rule One' },
  { id: 'R-2', category: 'claims', text: 'Rule Two' },
];

const findings: FindingItem[] = [
  { source_id: 'R-1', status: 'open' },
  { source_id: 'R-1', status: 'rejected' },
  { source_id: 'R-1', status: 'rejected' },
  { source_id: 'R-2', status: 'open' },
  { source_id: 'R-2', status: 'rejected' },
  { source_id: null, status: 'open' },
];

function setupMocks(
  findingsData: any = findings,
  rulesData: any = rules,
  userRole = 'manager',
  authenticated = true
) {
  if (authenticated) {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  } else {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not logged in'),
    });
  }

  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: userRole ? { role: userRole } : null,
          error: userRole ? null : new Error('Profile not found'),
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

describe('calculateRuleGaps calculation', () => {
  const sampleRules: BrandRuleItem[] = [
    { id: 'R-TONE-01', category: 'tone', text: 'Tone rule' },
    { id: 'R-CLAI-01', category: 'claims', text: 'Claims rule' },
    { id: 'R-TERM-01', category: 'terminology', text: 'Terminology rule' },
  ];

  it('marks rule as possibly unclear when flagged >= 3 times and rejected >= 50%', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-CLAI-01', status: 'accepted' },
      { source_id: 'R-CLAI-01', status: 'rejected' },
      { source_id: 'R-CLAI-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    const clai = result.find((r) => r.id === 'R-CLAI-01')!;

    expect(clai).toBeDefined();
    expect(clai.flagged).toBe(3);
    expect(clai.times_flagged).toBe(3);
    expect(clai.accepted).toBe(1);
    expect(clai.rejected).toBe(2);
    expect(clai.rejection_rate).toBeCloseTo(2 / 3);
    expect(clai.possibly_unclear).toBe(true);
    expect(clai.possiblyUnclear).toBe(true);
  });

  it('does not mark rule as possibly unclear when flagged < 3 times even if 100% rejected', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-TONE-01', status: 'rejected' },
      { source_id: 'R-TONE-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    const tone = result.find((r) => r.id === 'R-TONE-01')!;

    expect(tone).toBeDefined();
    expect(tone.flagged).toBe(2);
    expect(tone.rejected).toBe(2);
    expect(tone.rejection_rate).toBe(1.0);
    expect(tone.possibly_unclear).toBe(false);
  });

  it('does not mark rule as possibly unclear when flagged >= 3 times but rejection rate < 50%', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-TERM-01', status: 'accepted' },
      { source_id: 'R-TERM-01', status: 'accepted' },
      { source_id: 'R-TERM-01', status: 'accepted' },
      { source_id: 'R-TERM-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    const term = result.find((r) => r.id === 'R-TERM-01')!;

    expect(term).toBeDefined();
    expect(term.flagged).toBe(4);
    expect(term.accepted).toBe(3);
    expect(term.rejected).toBe(1);
    expect(term.rejection_rate).toBeCloseTo(0.25);
    expect(term.possibly_unclear).toBe(false);
  });

  it('marks rule as possibly unclear on exact 50% boundary with flagged >= 3', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-CLAI-01', status: 'accepted' },
      { source_id: 'R-CLAI-01', status: 'accepted' },
      { source_id: 'R-CLAI-01', status: 'rejected' },
      { source_id: 'R-CLAI-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    const clai = result.find((r) => r.id === 'R-CLAI-01')!;

    expect(clai.flagged).toBe(4);
    expect(clai.accepted).toBe(2);
    expect(clai.rejected).toBe(2);
    expect(clai.rejection_rate).toBe(0.5);
    expect(clai.possibly_unclear).toBe(true);
  });

  it('ranks rules primarily by rejection rate desc, then flagged count desc, then id asc', () => {
    const findingsList: FindingItem[] = [
      // R-CLAI-01: 3 flags, 2 rejected (rejection_rate = 0.667)
      { source_id: 'R-CLAI-01', status: 'accepted' },
      { source_id: 'R-CLAI-01', status: 'rejected' },
      { source_id: 'R-CLAI-01', status: 'rejected' },

      // R-TERM-01: 4 flags, 2 rejected (rejection_rate = 0.5)
      { source_id: 'R-TERM-01', status: 'accepted' },
      { source_id: 'R-TERM-01', status: 'accepted' },
      { source_id: 'R-TERM-01', status: 'rejected' },
      { source_id: 'R-TERM-01', status: 'rejected' },

      // R-TONE-01: 2 flags, 1 rejected (rejection_rate = 0.5)
      { source_id: 'R-TONE-01', status: 'accepted' },
      { source_id: 'R-TONE-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);

    expect(result.map((r) => r.id)).toEqual([
      'R-CLAI-01', // highest rejection rate (0.667)
      'R-TERM-01', // rejection rate 0.5, but 4 flags > 2 flags
      'R-TONE-01', // rejection rate 0.5, 2 flags
    ]);
  });

  it('counts open and accepted as accepted, and leaves needs_human undecided', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-TONE-01', status: 'open' },
      { source_id: 'R-TONE-01', status: 'accepted' },
      { source_id: 'R-TONE-01', status: 'needs_human' },
      { source_id: 'R-TONE-01', status: 'rejected' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    const tone = result.find((r) => r.id === 'R-TONE-01')!;

    expect(tone.flagged).toBe(4);
    expect(tone.accepted).toBe(2); // 1 open + 1 accepted
    expect(tone.rejected).toBe(1);
    expect(tone.rejection_rate).toBeCloseTo(1 / 4);
  });

  it('ignores findings with null source_id or facts', () => {
    const findingsList: FindingItem[] = [
      { source_id: null, status: 'rejected' },
      { source_id: 'F-FACT-01', status: 'rejected' },
      { source_id: 'R-TONE-01', status: 'accepted' },
    ];

    const result = calculateRuleGaps(sampleRules, findingsList);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('R-TONE-01');
  });

  it('includes unflagged rules when includeUnflagged is true', () => {
    const findingsList: FindingItem[] = [
      { source_id: 'R-TONE-01', status: 'accepted' },
    ];

    const resultDefault = calculateRuleGaps(sampleRules, findingsList);
    expect(resultDefault).toHaveLength(1);

    const resultAll = calculateRuleGaps(sampleRules, findingsList, {
      includeUnflagged: true,
    });
    expect(resultAll).toHaveLength(3);
    const unflagged = resultAll.find((r) => r.id === 'R-CLAI-01')!;
    expect(unflagged.flagged).toBe(0);
    expect(unflagged.rejection_rate).toBe(0);
    expect(unflagged.possibly_unclear).toBe(false);
  });
});

describe('GET /api/insights/gaps route handler', () => {
  it('returns ranked rule stats with possibly_unclear flag', async () => {
    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(200);
    expect(json.gaps).toBeInstanceOf(Array);

    // R-1: 3 findings, 2 rejected, rejection rate 2/3
    expect(json.gaps[0].id).toBe('R-1');
    expect(json.gaps[0].flagged).toBe(3);
    expect(json.gaps[0].times_flagged).toBe(3);
    expect(json.gaps[0].accepted).toBe(1);
    expect(json.gaps[0].rejected).toBe(2);
    expect(json.gaps[0].rejection_rate).toBeCloseTo(2 / 3);
    expect(json.gaps[0].possibly_unclear).toBe(true);

    // R-2: 2 findings, 1 rejected, rejection rate 1/2
    expect(json.gaps[1].id).toBe('R-2');
    expect(json.gaps[1].flagged).toBe(2);
    expect(json.gaps[1].times_flagged).toBe(2);
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

  it('returns 401 when unauthenticated', async () => {
    setupMocks(findings, rules, 'manager', false);

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(401);
    expect(json.error).toBe('Unauthenticated');
  });

  it('returns 403 when user is a creator', async () => {
    setupMocks(findings, rules, 'creator', true);

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(403);
    expect(json.error).toBe('Forbidden: managers and admins only');
  });

  it('returns 200 when user is an admin', async () => {
    setupMocks(findings, rules, 'admin', true);

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(200);
    expect(json.gaps).toBeDefined();
    expect(json.gaps.length).toBeGreaterThan(0);
  });

  it('returns 500 when findings query fails', async () => {
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
          data: null,
          error: new Error('DB connection failed'),
        });
        return chain;
      }
      return {};
    });

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(500);
    expect(json.error).toBe('Failed to fetch findings');
  });

  it('returns 500 when brand_rules query fails', async () => {
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
          data: findings,
          error: null,
        });
        return chain;
      }
      if (table === 'brand_rules') {
        return {
          select: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Rules fetch error'),
          }),
        };
      }
      return {};
    });

    const req = new Request('http://localhost/api/insights/gaps');
    const resp = await GET(req as any);
    const json = await resp.json();

    expect(resp.status).toBe(500);
    expect(json.error).toBe('Failed to fetch brand rules');
  });
});
