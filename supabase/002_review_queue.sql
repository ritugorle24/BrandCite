-- =============================================================
-- Migration 002 — Add review-queue columns to findings
-- Run AFTER schema.sql
-- =============================================================

-- New columns for the resolve workflow
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note  text,
  ADD COLUMN IF NOT EXISTS escalation_reason text;   -- 'low_confidence' | 'no_source' | 'unmatched_claim'

-- Index for the review-queue query (status = 'needs_human')
CREATE INDEX IF NOT EXISTS findings_needs_human_idx ON findings (status) WHERE status = 'needs_human';
