# BrandCite - project context for the coding agent

## What we are building
BrandCite is a brand-governance web app. A creator submits a text draft. The system checks it against the organisation's APPROVED brand rules, approved facts (with expiry dates) and preferred/banned terms, then shows findings. A manager approves or requests changes. A dashboard shows rules that are often rejected (possibly unclear guidelines).

## Non-negotiable product rules
1. Every finding must cite a source_id (a rule id like R-TONE-01 or a fact id like F-SEC-01) that exists in the database. If the AI returns a missing or unknown source_id, set source_id to null and status to needs_human. Never invent sources.
2. Findings with confidence below 0.6 get status needs_human.
3. Never change the user's text automatically. Suggestions are shown; the creator decides.
4. Only rules and facts with approved = true may be used in reviews.
5. Every AI-assisted finding is labelled ai_assisted = true and shown with an AI notice.
6. If the AI providers fail, return rules-only results with the notice "AI review unavailable, rules-only results". Never crash.
7. Roles: creator, manager, admin. Creators see only their own drafts. Only admins edit rules, facts and terms. Only managers or admins approve drafts.

## Stack
Next.js (App Router, TypeScript, Tailwind), Next.js API routes, Supabase (Postgres, Auth, Row Level Security), Vitest for tests, deployed on Vercel.
AI: one provider-agnostic client in lib/llm.ts using the OpenAI-compatible chat completions format. Primary: Gemini free tier. Fallback: Groq free tier. Config only through environment variables (LLM_PRIMARY_BASE_URL, LLM_PRIMARY_KEY, LLM_PRIMARY_MODEL, LLM_FALLBACK_BASE_URL, LLM_FALLBACK_KEY, LLM_FALLBACK_MODEL).
No embeddings. Retrieval is a keyword and category shortlist (max 12 rules, 8 facts).

## Data model (Postgres)
profiles, brand_rules, approved_facts (valid_until), terms, drafts (status: draft, in_review, changes_requested, approved), draft_versions, findings (source_id nullable, confidence, status: open, accepted, rejected, needs_human, ai_assisted), comments, approvals, audit_log.
Sample data is a FICTIONAL coffee brand called NovaBrew. Never use real company data.

## Code conventions
- TypeScript strict mode. No any unless justified in a comment.
- Business logic lives in lib/, API routes stay thin.
- Every API route returns consistent JSON errors: { error: string, code: string } with a correct HTTP status.
- Never log API keys, tokens or full prompts. Never hard-code secrets. .env.local is git-ignored; .env.example has empty values.
- Write Vitest tests for lib/ logic (exact checks, validator, claims, state machine, gap calculation).
- Validate all input (length limits, required fields). Draft text max 5000 characters.

## How to work with me
- One feature per prompt. Show a short plan and the files you will change BEFORE editing.
- List any new dependency you add and why.
- Do not add features I did not ask for. Do not refactor unrelated files.
- After changes, tell me how to run and test them (exact commands).
- If something is ambiguous, ask one short question instead of guessing.

## Out of scope
Video, multiple languages, third-party integrations, single sign-on, embeddings. DOCX/PDF and image review are optional stretch goals, only if I ask.

## Current status
(Update after each step.)
- [x] Step 0 project setup and deploy
- [x] Step 1 schema and seed
- [x] Step 2 LLM client
- [x] Step 3 exact checks
- [x] Step 4 review pipeline and validator
- [x] Step 5 review API and sample evaluation
- [x] Step 6 auth and roles
- [x] Step 7 drafts, versions, decisions
- [x] Step 8 approval workflow and comments
- [x] Step 9 claim verifier
- [x] Step 10 escalation queue
- [x] Step 11 guideline-gap insights
- [x] Steps 12 to 14 screens (/login, /drafts, /drafts/new, /drafts/[id], /approvals, /admin/knowledge, /insights)
- [ ] Step 15 hardening
- [ ] Step 16 README and deployment




Read docs/PROJECT_CONTEXT.md before any task and follow it.
Every finding must cite an existing source_id, otherwise needs_human. Never invent sources.
Never change user text automatically. Never log or hard-code secrets.
One feature per prompt. Show a plan and file list before editing. List new dependencies.
Write tests for lib/ logic and tell me the exact commands to run and verify.