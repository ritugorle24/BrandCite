-- =============================================================
-- BrandCite — Database Schema
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Idempotent: uses CREATE TYPE IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
-- =============================================================

-- ──────────────────────────────────────────────
-- 1. ENUM TYPES
-- ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('creator', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE draft_status AS ENUM ('draft', 'in_review', 'changes_requested', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finding_status AS ENUM ('open', 'accepted', 'rejected', 'needs_human');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE term_type AS ENUM ('preferred', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_decision AS ENUM ('approved', 'changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rule_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────
-- 2. PROFILES
-- Mirrors auth.users; one row per registered user.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  role       user_role NOT NULL DEFAULT 'creator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 3. BRAND RULES
-- id format: R-<CATEGORY>-<NN>  e.g. R-TONE-01
-- Only rows with approved = true are used in reviews.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_rules (
  id          text PRIMARY KEY,                         -- e.g. R-TONE-01
  category    text NOT NULL,                            -- tone | terminology | claims | accessibility
  text        text NOT NULL,                            -- the rule body
  severity    rule_severity NOT NULL DEFAULT 'medium',
  approved    boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brand_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS brand_rules_category_idx ON brand_rules (category);
CREATE INDEX IF NOT EXISTS brand_rules_approved_idx ON brand_rules (approved);

-- ──────────────────────────────────────────────
-- 4. APPROVED FACTS
-- id format: F-<CATEGORY>-<NN>  e.g. F-SEC-01
-- valid_until nullable; null = no expiry.
-- Expired facts (valid_until < today) must NOT be used.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approved_facts (
  id           text PRIMARY KEY,                        -- e.g. F-SEC-01
  statement    text NOT NULL,
  source_note  text,
  valid_until  date,                                    -- null = perpetual
  approved     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE approved_facts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS approved_facts_approved_idx    ON approved_facts (approved);
CREATE INDEX IF NOT EXISTS approved_facts_valid_until_idx ON approved_facts (valid_until);

-- ──────────────────────────────────────────────
-- 5. TERMS
-- Preferred terms have a replacement (the preferred wording).
-- Banned terms may optionally point to the rule that bans them.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS terms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term        text NOT NULL UNIQUE,
  type        term_type NOT NULL,
  replacement text,                                     -- what to use instead
  rule_id     text REFERENCES brand_rules (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS terms_type_idx ON terms (type);

-- ──────────────────────────────────────────────
-- 6. DRAFTS
-- One draft per piece of brand content.
-- current_version tracks the latest draft_versions.version_no.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  title           text NOT NULL,
  status          draft_status NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS drafts_author_idx ON drafts (author_id);
CREATE INDEX IF NOT EXISTS drafts_status_idx ON drafts (status);

-- ──────────────────────────────────────────────
-- 7. DRAFT VERSIONS
-- Immutable snapshots of draft content.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS draft_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id   uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  content    text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, version_no)
);

ALTER TABLE draft_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS draft_versions_draft_idx ON draft_versions (draft_id);

-- ──────────────────────────────────────────────
-- 8. FINDINGS
-- One row per issue flagged during a review run.
-- source_id → brand_rules.id OR approved_facts.id (nullable).
-- confidence between 0.0 and 1.0.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS findings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  version_no  integer NOT NULL,
  source_id   text,                                     -- nullable
  issue       text NOT NULL,
  quote       text,                                     -- verbatim excerpt from draft
  severity    rule_severity NOT NULL DEFAULT 'medium',
  suggestion  text,
  confidence  numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status      finding_status NOT NULL DEFAULT 'open',
  ai_assisted boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS findings_draft_idx  ON findings (draft_id);
CREATE INDEX IF NOT EXISTS findings_source_idx ON findings (source_id);
CREATE INDEX IF NOT EXISTS findings_status_idx ON findings (status);

-- ──────────────────────────────────────────────
-- 9. COMMENTS
-- Threaded comments on a draft.
-- parent_id enables simple reply threading.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id   uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  parent_id  uuid REFERENCES comments (id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS comments_draft_idx  ON comments (draft_id);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_id);

-- ──────────────────────────────────────────────
-- 10. APPROVALS
-- One record per manager/admin decision on a draft.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approvals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id   uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  decision   approval_decision NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS approvals_draft_idx   ON approvals (draft_id);
CREATE INDEX IF NOT EXISTS approvals_manager_idx ON approvals (manager_id);

-- ──────────────────────────────────────────────
-- 11. AUDIT LOG
-- Append-only record of every significant action.
-- actor_id nullable to support system-generated events.
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES profiles (id) ON DELETE SET NULL,
  action      text NOT NULL,                            -- e.g. draft.submitted, finding.accepted
  entity_type text NOT NULL,                            -- e.g. draft, finding, brand_rule
  entity_id   text NOT NULL,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_log_actor_idx      ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx     ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);

-- ──────────────────────────────────────────────
-- 12. updated_at TRIGGER (shared)
-- Automatically refreshes updated_at on every UPDATE.
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'brand_rules', 'approved_facts',
    'drafts', 'findings', 'comments'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t
    );
  END LOOP;
END $$;
