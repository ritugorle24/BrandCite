# BrandCite &mdash; Testing Strategy & Verification Guide

BrandCite uses [Vitest](https://vitest.dev/) for unit testing pure business logic and API route handlers, combined with deterministic benchmarking scripts against standard marketing sample drafts.

---

## 1. Test Suite Summary

BrandCite contains **82 automated tests** across **9 test suites**, running with 0 failures:

| Test File | Tests | Focus Area |
| :--- | :--- | :--- |
| `lib/__tests__/exactChecks.test.ts` | 12 | Case-insensitive banned terms, preferred terms replacement, headline word limits. |
| `lib/__tests__/claims.test.ts` | 15 | Active facts, expired facts, perpetual facts (`valid_until: null`), unmatched claims escalation. |
| `lib/__tests__/review.test.ts` | 4 | Review pipeline integration, fallback resilience, retry parsing, confidence escalation. |
| `lib/__tests__/reviewQueue.test.ts` | 17 | Escalated finding resolution, RBAC role gating, state transitions, audit log recording. |
| `lib/__tests__/insights.test.ts` | 15 | Guideline gap math, `possibly_unclear` boundaries ($\ge 3$ flags, $\ge 50\%$ rejected), ranking, API handler. |
| `lib/__tests__/knowledge.test.ts` | 7 | Plain-language analysis note generation, unapproved items tracking, audit log sync. |
| `lib/__tests__/rateLimit.test.ts` | 3 | In-memory sliding window rate limiter, burst isolation, reset headers. |
| `lib/__tests__/diff.test.ts` | 4 | Pure LCS word-level diff viewer for version history comparisons. |
| `lib/__tests__/config.test.ts` | 5 | Configuration constants (5000 character maximum limit, 0.6 confidence threshold). |

---

## 2. Running Unit Tests

### Run All Tests
```bash
npx vitest run
```
*Expected Output:*
```
Test Files  9 passed (9)
     Tests  82 passed (82)
  Duration  ~2.8s
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test Suite
```bash
# Test exact checks
npm run test:exact

# Test claims verifier
npx vitest run lib/__tests__/claims.test.ts

# Test guideline insights
npx vitest run lib/__tests__/insights.test.ts
```

---

## 3. Sample Draft Evaluation (`scripts/run-samples.ts`)

The project includes 20 real-world sample drafts (`data/samples.json`) representing diverse brand copy for the fictional brand **NovaBrew**.

To benchmark the review pipeline against the sample set:
```bash
npm run run-samples
```

**Evaluation criteria evaluated:**
1. Detection accuracy against expected issues and quotes.
2. Citation of valid `source_id` references from approved brand rules or facts.
3. Fallback performance under high demand or network timeouts.

---

## 4. Decision Seeding Script (`scripts/seed-decisions.ts`)

The decision seeding script simulates realistic reviewer decisions across drafts so the **Guideline Gaps Dashboard** (`/insights`) has representative historical data:

```bash
npm run seed-decisions
```

**What the script does:**
1. Checks for existing drafts in Supabase; creates sample drafts if missing.
2. Runs exact rule and term checks to populate authentic review findings.
3. Applies realistic decisions (e.g. 10 rejections and 5 acceptances for `R-CLAI-01`) to demonstrate the `possibly_unclear` threshold.
4. Generates data for `R-CLAI-01` ($66.7\%$ rejection rate over 15 flags), triggering the warning badge in `/insights`.

---

## 5. Production Build Verification

To verify that all App Router pages and API routes compile with zero TypeScript or Turbopack errors:

```bash
npm run build
```

*Expected Output:*
```
✓ Compiled successfully
  Running TypeScript ...
✓ Generating static pages (20/20)
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ○ /admin/knowledge
├ ○ /approvals
├ ○ /drafts
├ ƒ /drafts/[id]
├ ○ /drafts/new
├ ○ /insights
└ ○ /login
```

---

## 6. Functional RBAC Verification Checklist

| Scenario | Tested Endpoint | Expected Behavior |
| :--- | :--- | :--- |
| Creator accesses `/admin/knowledge` | `GET /api/admin/knowledge` | HTTP 403 `FORBIDDEN` |
| Creator accesses `/insights` | `GET /api/insights/gaps` | HTTP 403 `FORBIDDEN` |
| Creator views another user's draft | `GET /api/drafts/[id]` | HTTP 403 `FORBIDDEN` |
| Creator submits text $> 5000$ chars | `POST /api/drafts` | HTTP 422 `INPUT_TOO_LONG` |
| Spamming review endpoint ($> 30$ req/min) | `POST /api/review` | HTTP 429 `RATE_LIMIT_EXCEEDED` |
| Manager resolves human review item | `POST /api/findings/[id]/resolve` | HTTP 200 `CONFIRMED` / `DISMISSED` |
| Manager approves draft in review | `POST /api/drafts/[id]/approval` | HTTP 200 & draft status `approved` |

