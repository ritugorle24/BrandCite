import { describe, it, expect, vi } from 'vitest';
import {
  generatePlainLanguageRuleNote,
  getUnapprovedTermIds,
  recordTermApprovalStatus,
} from '../knowledge';

describe('generatePlainLanguageRuleNote', () => {
  it('returns appropriate note when rule has never been flagged', () => {
    const note = generatePlainLanguageRuleNote({
      flagged: 0,
      accepted: 0,
      rejected: 0,
      rejection_rate: 0,
      possibly_unclear: false,
    });

    expect(note).toContain('No violations flagged yet');
  });

  it('highlights high rejection and ambiguity when possibly_unclear is true', () => {
    const note = generatePlainLanguageRuleNote({
      flagged: 10,
      accepted: 3,
      rejected: 7,
      rejection_rate: 0.7,
      possibly_unclear: true,
    });

    expect(note).toContain('Overturned 70% of the time');
    expect(note).toContain('ambiguous');
    expect(note).toContain('Consider clarifying');
  });

  it('recognizes well-understood, consistently accepted rules with sufficient volume', () => {
    const note = generatePlainLanguageRuleNote({
      flagged: 10,
      accepted: 9,
      rejected: 1,
      rejection_rate: 0.1,
      possibly_unclear: false,
    });

    expect(note).toContain('Consistently accepted');
    expect(note).toContain('90% accept rate');
  });

  it('notes low volume when flagged fewer than 3 times', () => {
    const note = generatePlainLanguageRuleNote({
      flagged: 2,
      accepted: 1,
      rejected: 1,
      rejection_rate: 0.5,
      possibly_unclear: false,
    });

    expect(note).toContain('Low review volume');
    expect(note).toContain('2 flags');
  });

  it('handles moderate rejection with context advice', () => {
    const note = generatePlainLanguageRuleNote({
      flagged: 6,
      accepted: 4,
      rejected: 2,
      rejection_rate: 0.33,
      possibly_unclear: false,
    });

    expect(note).toContain('Moderately accepted');
  });
});

describe('getUnapprovedTermIds & recordTermApprovalStatus', () => {
  it('aggregates audit log events to determine unapproved term ids', async () => {
    const mockEvents = [
      { entity_id: 'term-1', action: 'term.unapproved', created_at: '2026-11-01T00:00:00Z' },
      { entity_id: 'term-2', action: 'term.unapproved', created_at: '2026-11-02T00:00:00Z' },
      { entity_id: 'term-1', action: 'term.approved', created_at: '2026-11-03T00:00:00Z' }, // re-approved
    ];

    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
          }),
        }),
      }),
    };

    const unapproved = await getUnapprovedTermIds(mockSupabase);
    expect(unapproved.has('term-2')).toBe(true);
    expect(unapproved.has('term-1')).toBe(false);
  });

  it('records term approval status in audit log', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        insert: insertMock,
      }),
    };

    await recordTermApprovalStatus(mockSupabase, 'term-xyz', false, 'admin-123');

    expect(mockSupabase.from).toHaveBeenCalledWith('audit_log');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'admin-123',
        action: 'term.unapproved',
        entity_type: 'term',
        entity_id: 'term-xyz',
      })
    );
  });
});

