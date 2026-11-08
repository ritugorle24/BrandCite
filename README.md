# BrandCite &mdash; Brand Governance & AI Compliance Review

**BrandCite** is an AI-powered brand governance platform designed for enterprise marketing teams. When creators compose marketing copy, the system verifies the copy against approved brand rules, approved facts (with strict expiry dates), and preferred/banned terminology. Managers review escalated findings and approve drafts, while an analytics dashboard highlights ambiguous or frequently rejected brand guidelines.

The sample dataset features a fictional specialty coffee brand, **NovaBrew Coffee**.

---

## 🌐 Live URL & Demo Logins

- **Live Deployment**: [https://brandcite.vercel.app](https://brandcite.vercel.app) *(or `http://localhost:3000` when running locally)*

### Pre-Configured Demo Accounts

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Creator** | `creator.demo@example.com` | `DemoPassword123!` | Create drafts, view review findings, accept/reject suggestions, submit for approval. |
| **Manager** | `manager.demo@example.com` | `DemoPassword123!` | All creator capabilities + manager approval queue, triage `needs_human` findings, view `/insights`. |
| **Admin** | `admin.demo@example.com` | `DemoPassword123!` | All manager capabilities + `/admin/knowledge` base management (add, edit, toggle approved rules, facts, terms). |

---

## 🚀 What the Product Does

1. **Deterministic & Contextual Review Engine**:
   - **Exact Rule Checks**: Instantly catches banned terms (e.g. `Nova Brew` &rarr; `NovaBrew`), preferred roast names, and headline length limits ($\le 10$ words).
   - **Claim & Expiry Verification**: Cross-references factual assertions with verified company facts. Automatically flags claims supported only by expired certifications (`valid_until < today`).
   - **AI-Assisted Tone & Style Review**: Employs an LLM to detect passive voice, jargon, and accessibility reading levels, always labelling findings with `ai_assisted: true`.
2. **Strict Source Grounding & No Hallucinations**:
   - Every finding cites an existing database ID (`R-TONE-01`, `F-SUST-01`).
   - If the AI returns an unknown source ID or low confidence ($< 0.6$), the finding is flagged as `needs_human` and escalated to managers.
3. **Non-Destructive Creator Experience**:
   - The creator's text is **never changed automatically**. Suggestions are displayed in a two-column editor with clickable inline highlights; creators accept, reject, or edit.
4. **Approval Workflow & Version Diff**:
   - Sequential draft versions with an LCS word-level diff viewer showing added/removed copy.
   - Threaded comments on drafts.
   - Status tracking: `draft` &rarr; `in_review` &rarr; `approved` / `changes_requested`.
5. **Guideline Gaps Analytics (`/insights`)**:
   - Ranks brand rules by reviewer rejection rate.
   - Guidelines flagged $\ge 3$ times and rejected $\ge 50\%$ are marked **⚠️ Possibly Unclear**, alerting brand managers to clarify the wording.
6. **Knowledge Base Management (`/admin/knowledge`)**:
   - Admin-only portal to list, add, edit, and toggle approval for brand rules, facts (with expiry date picker), and terms. Unapproved items are excluded from reviews.

---

## 🛠️ Architecture Summary

```
Draft Copy ──► Exact Checks & Claim Verifier ──► Lexical Shortlist (max 12 rules, 8 facts)
                        │                                  │
                        ▼                                  ▼
           Deterministic Findings                 LLM Chat Completion
                        │                       (Gemini ──failover──► Groq)
                        │                                  │
                        └───────────────┬──────────────────┘
                                        ▼
                           Finding Validator & Gate
                    (Missing source / Conf < 0.6 ──► needs_human)
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                  Creator Editor UI            Manager Review Queue
                  (/drafts/[id])                  (/approvals)
```

For complete technical specifications, database schemas, and state machine diagrams, see **[docs/architecture.md](docs/architecture.md)**.

---

## 🤖 AI Tools & External Services Used

- **[Google Antigravity](https://deepmind.google/technologies/gemini/)**: Advanced agentic coding assistant used throughout development for scaffolding, test-driven implementation, and hardening.
- **[Google Gemini API](https://ai.google.dev/)** (`gemini-2.5-flash`): Primary LLM provider for contextual brand guideline evaluation and tone checking.
- **[Groq Cloud API](https://groq.com/)** (`llama-3.3-70b-versatile`): Fallback high-speed LLM provider for zero-downtime automated failover.
- **[Supabase](https://supabase.com/)**: Managed PostgreSQL database, Supabase Auth with secure SSR session cookies, and Row Level Security (RLS).
- **[Vercel](https://vercel.com/)**: Production hosting, edge proxy, and continuous deployment pipeline.

---

## 📦 Setup & Installation

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+
- **npm**: v9+
- A Supabase project with PostgreSQL.

### 2. Clone and Install
```bash
git clone https://github.com/ritugorle24/BrandCite.git
cd BrandCite
npm install
```

### 3. Configure Environment Variables
Copy the template to `.env.local`:
```bash
cp .env.example .env.local
```

Configure the environment variables in `.env.local` *(no secrets should ever be committed)*:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Primary LLM Provider (Google Gemini API)
LLM_PRIMARY_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_PRIMARY_KEY=your-gemini-api-key
LLM_PRIMARY_MODEL=gemini-2.5-flash

# Fallback LLM Provider (Groq Cloud API)
LLM_FALLBACK_BASE_URL=https://api.groq.com/openai/v1
LLM_FALLBACK_KEY=your-groq-api-key
LLM_FALLBACK_MODEL=llama-3.3-70b-versatile
```

### 4. Database Schema & Seed Data
Execute the SQL migrations in the Supabase SQL Editor:
1. `supabase/schema.sql` (Tables, ENUMs, triggers, and RLS policies).
2. `supabase/seed.sql` (15 brand rules, 10 approved facts, 20 terminology entries).

### 5. Seed Historical Review Decisions
Populate sample drafts and realistic reviewer decisions for the insights dashboard:
```bash
npm run seed-decisions
```

### 6. Run Local Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Testing & Verification

For detailed test coverage documentation, see **[docs/testing.md](docs/testing.md)**.

### Run Unit Tests
```bash
npx vitest run
```
*Executes all 82 unit tests across 9 test suites (exact checks, claim verifier, LLM retry/fallback, review queue, guideline gaps, rate limiting, and diff viewer).*

### Run Sample Draft Evaluation
```bash
npm run run-samples
```
*Benchmarks the review engine against 20 diverse marketing drafts from `data/samples.json`.*

### Verify Production Build
```bash
npm run build
```
*Verifies static page generation and strict TypeScript compliance across all 20 App Router routes.*

---

## ⚠️ Known Limitations & Out of Scope

1. **Text Copy Only**: Review is optimized for textual marketing copy (social posts, emails, web copy, headlines). Binary DOCX/PDF document parsing and image OCR are out of scope.
2. **In-Memory Rate Limiting**: The sliding-window rate limiter on `/api/review` operates in process memory (30 req/min per IP). For multi-region serverless clusters, an external Redis store (Upstash) can be dropped in.
3. **Lexical Heuristic Shortlisting**: To preserve low latency and avoid vector embedding database requirements, candidate rules and facts are shortlisted via lexical relevance scoring (max 12 rules, 8 facts).
4. **Single Brand Scope**: The default instance is configured for the fictional coffee brand NovaBrew. Multi-tenant brand profiles can be managed through separate organizational rule sets.
