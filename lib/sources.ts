export interface SourceInfo {
  id: string;
  category?: string;
  text: string;
  type: 'rule' | 'fact';
}

export const KNOWN_SOURCES: Record<string, SourceInfo> = {
  // Brand Rules
  'R-TONE-01': {
    id: 'R-TONE-01',
    category: 'tone',
    text: 'All copy must use a warm, conversational tone. Avoid corporate jargon, passive constructions, and overly formal phrasing. Write as if speaking to a friend who loves great coffee.',
    type: 'rule',
  },
  'R-TONE-02': {
    id: 'R-TONE-02',
    category: 'tone',
    text: 'Lead with benefits and positive outcomes. Do not open a sentence with a negative construct. Reframe negatives as positives wherever possible.',
    type: 'rule',
  },
  'R-TONE-03': {
    id: 'R-TONE-03',
    category: 'tone',
    text: 'Avoid gendered greetings or age-specific assumptions. Use everyone, folks, you or address the reader directly.',
    type: 'rule',
  },
  'R-TONE-04': {
    id: 'R-TONE-04',
    category: 'tone',
    text: 'Headlines and subject lines must be 10 words or fewer. Sub-headlines may extend to 18 words. Cut filler words first.',
    type: 'rule',
  },
  'R-TERM-01': {
    id: 'R-TERM-01',
    category: 'terminology',
    text: 'Always write NovaBrew as one word with capital N and B. Never write Nova Brew, novabrew or NOVABREW. The trademark symbol is required on first mention per page.',
    type: 'rule',
  },
  'R-TERM-02': {
    id: 'R-TERM-02',
    category: 'terminology',
    text: 'Use only approved roast level names: Light Lift, Morning Blend, Deep Ember and Midnight Reserve.',
    type: 'rule',
  },
  'R-TERM-03': {
    id: 'R-TERM-03',
    category: 'terminology',
    text: 'Never mention competitor brand names in consumer-facing copy. Use leading brands or conventional blends instead.',
    type: 'rule',
  },
  'R-TERM-04': {
    id: 'R-TERM-04',
    category: 'terminology',
    text: 'Approved flavour descriptors: bright, velvety, bold, crisp, smooth, earthy, floral and nutty.',
    type: 'rule',
  },
  'R-CLAI-01': {
    id: 'R-CLAI-01',
    category: 'claims',
    text: 'Any sustainability or environmental claim must reference an approved fact ID. Unsubstantiated environmental claims are prohibited.',
    type: 'rule',
  },
  'R-CLAI-02': {
    id: 'R-CLAI-02',
    category: 'claims',
    text: 'Do not use best, number one, worlds finest or similar superlatives unless backed by a cited third-party study or award.',
    type: 'rule',
  },
  'R-CLAI-03': {
    id: 'R-CLAI-03',
    category: 'claims',
    text: 'Do not make direct or implied health or medical claims. Flavour or sensory descriptions are permitted.',
    type: 'rule',
  },
  'R-CLAI-04': {
    id: 'R-CLAI-04',
    category: 'claims',
    text: 'Geographic origin claims must correspond to an active approved fact. Expired sourcing claims must be updated or removed.',
    type: 'rule',
  },
  'R-ACCS-01': {
    id: 'R-ACCS-01',
    category: 'accessibility',
    text: 'Every product image must have descriptive alt text that conveys the image content.',
    type: 'rule',
  },
  'R-ACCS-02': {
    id: 'R-ACCS-02',
    category: 'accessibility',
    text: 'Colour contrast must meet WCAG AA requirements: 4.5:1 for body text and 3:1 for large text.',
    type: 'rule',
  },
  'R-ACCS-03': {
    id: 'R-ACCS-03',
    category: 'accessibility',
    text: 'Body copy must target a Flesch-Kincaid reading level of 8 or below. Avoid jargon and sentences over 25 words.',
    type: 'rule',
  },

  // Approved Facts
  'F-SUST-01': {
    id: 'F-SUST-01',
    category: 'sustainability',
    text: 'NovaBrew achieved carbon-neutral status for its roasting operations in 2024.',
    type: 'fact',
  },
  'F-SUST-02': {
    id: 'F-SUST-02',
    category: 'sustainability',
    text: '100% of NovaBrew packaging is made from compostable plant-based materials as of Q1 2025.',
    type: 'fact',
  },
  'F-SUST-03': {
    id: 'F-SUST-03',
    category: 'sustainability',
    text: 'NovaBrew 2023 harvest season produced zero single-use plastic waste across partner farms.',
    type: 'fact',
  },
  'F-ORIG-01': {
    id: 'F-ORIG-01',
    category: 'origin',
    text: 'NovaBrew Deep Ember is single-origin, sourced from the Yirgacheffe region of Ethiopia.',
    type: 'fact',
  },
  'F-ORIG-02': {
    id: 'F-ORIG-02',
    category: 'origin',
    text: 'NovaBrew Midnight Reserve 2023 edition used beans exclusively from Huila, Colombia.',
    type: 'fact',
  },
  'F-ORIG-03': {
    id: 'F-ORIG-03',
    category: 'origin',
    text: 'NovaBrew Morning Blend sources 60% of its beans from certified farms in Guatemala and Honduras.',
    type: 'fact',
  },
  'F-AWRD-01': {
    id: 'F-AWRD-01',
    category: 'awards',
    text: 'NovaBrew Light Lift received Best Light Roast at the fictional Specialty Coffee Expo 2025.',
    type: 'fact',
  },
  'F-AWRD-02': {
    id: 'F-AWRD-02',
    category: 'awards',
    text: 'NovaBrew ranked third in the fictional 2025 Most Trusted Coffee Brands survey.',
    type: 'fact',
  },
  'F-PROD-01': {
    id: 'F-PROD-01',
    category: 'product',
    text: 'NovaBrew Midnight Reserve contains approximately 140 mg of caffeine per 237 ml serving.',
    type: 'fact',
  },
  'F-PROD-02': {
    id: 'F-PROD-02',
    category: 'product',
    text: 'All NovaBrew roasts use 100% Arabica beans.',
    type: 'fact',
  },
};

export function getSourceInfo(sourceId: string | null | undefined): SourceInfo | null {
  if (!sourceId) return null;
  return (
    KNOWN_SOURCES[sourceId] ?? {
      id: sourceId,
      category: 'guideline',
      text: `Official brand specification reference (${sourceId})`,
      type: sourceId.startsWith('F-') ? 'fact' : 'rule',
    }
  );
}

