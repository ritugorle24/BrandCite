-- =============================================================
-- BrandCite — Seed Data
-- Fictional Brand: NovaBrew Coffee
-- Run AFTER schema.sql
-- =============================================================


-- =============================================================
-- 1. BRAND RULES (15 RECORDS)
-- =============================================================

INSERT INTO brand_rules
(id, category, text, severity, approved, approved_by)
VALUES

-- TONE (4)

('R-TONE-01', 'tone',
'All copy must use a warm, conversational tone. Avoid corporate jargon, passive constructions, and overly formal phrasing. Write as if speaking to a friend who loves great coffee.',
'high', true, NULL),

('R-TONE-02', 'tone',
'Lead with benefits and positive outcomes. Do not open a sentence with a negative construct. Reframe negatives as positives wherever possible.',
'medium', true, NULL),

('R-TONE-03', 'tone',
'Avoid gendered greetings or age-specific assumptions. Use everyone, folks, you or address the reader directly.',
'high', true, NULL),

('R-TONE-04', 'tone',
'Headlines and subject lines must be 10 words or fewer. Sub-headlines may extend to 18 words. Cut filler words first.',
'low', true, NULL),

-- TERMINOLOGY (4)

('R-TERM-01', 'terminology',
'Always write NovaBrew as one word with capital N and B. Never write Nova Brew, novabrew or NOVABREW. The trademark symbol is required on first mention per page.',
'high', true, NULL),

('R-TERM-02', 'terminology',
'Use only approved roast level names: Light Lift, Morning Blend, Deep Ember and Midnight Reserve.',
'high', true, NULL),

('R-TERM-03', 'terminology',
'Never mention competitor brand names in consumer-facing copy. Use leading brands or conventional blends instead.',
'high', true, NULL),

('R-TERM-04', 'terminology',
'Approved flavour descriptors: bright, velvety, bold, crisp, smooth, earthy, floral and nutty.',
'medium', true, NULL),

-- CLAIMS (4)

('R-CLAI-01', 'claims',
'Any sustainability or environmental claim must reference an approved fact ID. Unsubstantiated environmental claims are prohibited.',
'high', true, NULL),

('R-CLAI-02', 'claims',
'Do not use best, number one, worlds finest or similar superlatives unless backed by a cited third-party study or award.',
'high', true, NULL),

('R-CLAI-03', 'claims',
'Do not make direct or implied health or medical claims. Flavour or sensory descriptions are permitted.',
'high', true, NULL),

('R-CLAI-04', 'claims',
'Geographic origin claims must correspond to an active approved fact. Expired sourcing claims must be updated or removed.',
'medium', true, NULL),

-- ACCESSIBILITY (3)

('R-ACCS-01', 'accessibility',
'Every product image must have descriptive alt text that conveys the image content.',
'medium', true, NULL),

('R-ACCS-02', 'accessibility',
'Colour contrast must meet WCAG AA requirements: 4.5:1 for body text and 3:1 for large text.',
'medium', true, NULL),

('R-ACCS-03', 'accessibility',
'Body copy must target a Flesch-Kincaid reading level of 8 or below. Avoid jargon and sentences over 25 words.',
'low', true, NULL)

ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- 2. APPROVED FACTS (10 RECORDS)
-- Exactly 2 intentionally expired
-- =============================================================

INSERT INTO approved_facts
(id, statement, source_note, valid_until, approved)
VALUES

('F-SUST-01',
'NovaBrew achieved carbon-neutral status for its roasting operations in 2024.',
'Fictional NovaBrew certification report, March 2024.',
NULL, true),

('F-SUST-02',
'100% of NovaBrew packaging is made from compostable plant-based materials as of Q1 2025.',
'Fictional NovaBrew packaging audit, February 2025.',
NULL, true),

('F-SUST-03',
'NovaBrew 2023 harvest season produced zero single-use plastic waste across partner farms.',
'Fictional 2023 sustainability report.',
'2024-06-30', true),

('F-ORIG-01',
'NovaBrew Deep Ember is single-origin, sourced from the Yirgacheffe region of Ethiopia.',
'Fictional NovaBrew direct-trade agreement, January 2025.',
'2025-12-31', true),

('F-ORIG-02',
'NovaBrew Midnight Reserve 2023 edition used beans exclusively from Huila, Colombia.',
'Fictional 2023 origin certificate.',
'2024-03-31', true),

('F-ORIG-03',
'NovaBrew Morning Blend sources 60% of its beans from certified farms in Guatemala and Honduras.',
'Fictional NovaBrew sourcing report, 2025.',
NULL, true),

('F-AWRD-01',
'NovaBrew Light Lift received Best Light Roast at the fictional Specialty Coffee Expo 2025.',
'Fictional NovaBrew awards record, April 2025.',
NULL, true),

('F-AWRD-02',
'NovaBrew ranked third in the fictional 2025 Most Trusted Coffee Brands survey.',
'Fictional Consumer Grounds Magazine survey, May 2025.',
NULL, true),

('F-PROD-01',
'NovaBrew Midnight Reserve contains approximately 140 mg of caffeine per 237 ml serving.',
'Fictional NovaBrew laboratory analysis, January 2025.',
NULL, true),

('F-PROD-02',
'All NovaBrew roasts use 100% Arabica beans.',
'Fictional NovaBrew Quality Standards Document, 2025.',
NULL, true)

ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- 3. TERMS (20 RECORDS)
-- 10 BANNED + 10 PREFERRED
-- =============================================================

INSERT INTO terms
(term, type, replacement, rule_id)
VALUES

-- BANNED TERMS (10)

('Nova Brew', 'banned', 'NovaBrew', 'R-TERM-01'),

('novabrew', 'banned', 'NovaBrew', 'R-TERM-01'),

('NOVABREW', 'banned', 'NovaBrew', 'R-TERM-01'),

('guys', 'banned', 'everyone / folks', 'R-TONE-03'),

('ladies and gentlemen', 'banned', 'everyone', 'R-TONE-03'),

('number one', 'banned', 'among the finest (with citation)', 'R-CLAI-02'),

('worlds best', 'banned', 'among the worlds finest (with citation)', 'R-CLAI-02'),

('boosts immunity', 'banned', NULL, 'R-CLAI-03'),

('improves focus', 'banned', NULL, 'R-CLAI-03'),

('cheap', 'banned', 'accessible / value-friendly', 'R-TONE-01'),

-- PREFERRED TERMS (10)

('NovaBrew™', 'preferred', 'Use on first mention per page', 'R-TERM-01'),

('Light Lift', 'preferred', 'Approved roast level name', 'R-TERM-02'),

('Morning Blend', 'preferred', 'Approved roast level name', 'R-TERM-02'),

('Deep Ember', 'preferred', 'Approved roast level name', 'R-TERM-02'),

('Midnight Reserve', 'preferred', 'Approved roast level name', 'R-TERM-02'),

('bright', 'preferred', 'Approved flavour descriptor', 'R-TERM-04'),

('velvety', 'preferred', 'Approved flavour descriptor', 'R-TERM-04'),

('bold', 'preferred', 'Approved flavour descriptor', 'R-TERM-04'),

('leading brands', 'preferred', 'Use instead of competitor names', 'R-TERM-03'),

('conventional blends', 'preferred', 'Use instead of competitor names', 'R-TERM-03')

ON CONFLICT (term) DO NOTHING;


-- =============================================================
-- SEED COMPLETE
-- =============================================================

SELECT 'brand_rules' AS table_name, COUNT(*) AS total
FROM brand_rules

UNION ALL

SELECT 'approved_facts', COUNT(*)
FROM approved_facts

UNION ALL

SELECT 'terms', COUNT(*)
FROM terms;