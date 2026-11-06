-- =============================================================
-- 3. FINDINGS – additional review columns
-- =============================================================

-- Add columns for reviewer metadata and escalation reason.
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS escalation_reason text;

-- Optional: create index on reviewed_by for faster lookup.
CREATE INDEX IF NOT EXISTS findings_reviewed_by_idx ON findings (reviewed_by);
