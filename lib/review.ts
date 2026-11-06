import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { callLLM, LLMUnavailableError } from './llm.ts';
import {
  runExactChecks,
  type Finding as ExactFinding,
  type Term,
} from './exactChecks.ts';
import { checkClaims, type ApprovedFact } from './claims.ts';

export interface ReviewFinding extends ExactFinding {
  /**
   * Status of the finding after validation.
   * - 'open' (default for exact checks)
   * - 'needs_human' when source is missing or confidence low
   */
  status?: 'open' | 'needs_human';
}

/**
 * Load approved rules and facts from Supabase.
 * Returns an object with arrays of rules and facts (both contain at least `id` and `category`).
 */
async function loadApprovedData(supabase: SupabaseClient) {
  const [
    { data: rules, error: rulesErr },
    { data: facts, error: factsErr },
    { data: terms, error: termsErr },
  ] = await Promise.all([
    supabase
      .from('brand_rules')
      .select('id, category, text')
      .eq('approved', true),

    supabase
      .from('approved_facts')
      .select('id, statement, valid_until')
      .eq('approved', true),

    supabase
      .from('terms')
      .select('id, term, type, replacement, rule_id'),
  ]);

  if (rulesErr) throw rulesErr;
  if (factsErr) throw factsErr;
  if (termsErr) throw termsErr;

  return {
    rules: rules ?? [],
    facts: facts ?? [],
    terms: (terms ?? []) as Term[],
  };
}

/**
 * Simple relevance scoring: count occurrences of rule/fact text or category words in the draft.
 * Returns at most `maxRules` rules and `maxFacts` facts ordered by relevance.
 */
function shortlist(
  draft: string,
  rules: any[],
  facts: any[],
  maxRules = 12,
  maxFacts = 8
) {
  const lowered = draft.toLowerCase();
  const scoreItem = (item: any) => {
    // brand_rules use `text` + `category`; approved_facts use `statement` (no category)
    const txt = `${item.text ?? item.statement ?? ''} ${item.category ?? ''}`.toLowerCase();
    let score = 0;
    const words = txt.split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (lowered.includes(w)) score++;
    }
    return score;
  };

  const sortedRules = [...rules]
    .map((r) => ({ ...r, _score: scoreItem(r) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, maxRules);

  const sortedFacts = [...facts]
    .map((f) => ({ ...f, _score: scoreItem(f) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, maxFacts);

  return { rules: sortedRules, facts: sortedFacts };
}

/**
 * Build the prompt for the LLM.
 */
function buildPrompt(
  draft: string,
  rules: any[],
  facts: any[]
): { system: string; user: string } {
  const system = `You are an AI reviewer for the BrandCite system. Given a draft text and a shortlist of approved brand rules and facts, you must identify any issues.
Return ONLY a JSON array (no extra text) where each element has the shape:
{ "source_id": string | null, "issue": string, "quote": string, "severity": string, "suggestion": string | null, "confidence": number }
The source_id must be one of the provided rule/fact ids or null if no source applies.`;

  const user = `Draft:\n"""
${draft}
"""

Shortlisted rules (ids only): ${rules.map((r) => r.id).join(', ')}
Shortlisted facts (ids only): ${facts.map((f) => f.id).join(', ')}`;

  return { system, user };
}

/**
 * Safely parse JSON possibly wrapped in code fences.
 */
function safeParse(jsonStr: string): any {
  // Remove markdown fences if present
  const cleaned = jsonStr
    .replace(/^\s*```json\s*\n/, '')
    .replace(/^\s*```\s*\n?/, '')
    .replace(/\n?```\s*$/g, '')
    .trim();

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = cleaned.substring(start, end + 1);
    return JSON.parse(slice);
  }
  // If we cannot locate a proper JSON array, throw to trigger retry logic
  throw new Error('Unable to locate JSON array in LLM response');
}
/**
 * Main entry: review a draft.
 */
export async function reviewDraft(draft: string): Promise<ReviewFinding[]> {
  // 1. Load data from Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

const { rules, facts, terms } = await loadApprovedData(supabase);
console.log('[DEBUG] Loaded rules:', rules.length);
console.log('[DEBUG] Loaded facts:', facts.length);
console.log('[DEBUG] Loaded terms:', terms.length);

console.log(
  '[DEBUG] Relevant terms:',
  terms.filter((t) =>
    ['guys', 'nova brew'].includes(t.term.toLowerCase())
  )
);

// 2. Shortlist relevant items
  const { rules: shortRules, facts: shortFacts } = shortlist(draft, rules, facts);

  // 3. Run exact checks (no terms supplied for now)
const exactResults = await runExactChecks(draft, terms, rules);

const validRuleIds = new Set(rules.map((r: any) => r.id));

const exactFindings: ReviewFinding[] = exactResults.map((f) => ({
  ...f,
  status: validRuleIds.has(f.source_id ?? '') ? 'open' : 'needs_human',
}));
  // 4. Build prompt and call LLM
  const { system, user } = buildPrompt(draft, shortRules, shortFacts);

  let llmFindings: ReviewFinding[] = [];
  try {
    const { text: llmResponse } = await callLLM({ system, user });
    let parsed: any;
    try {
      parsed = safeParse(llmResponse);
    } catch (e) {
      // First parse failed – attempt a second LLM call (retry) and parse again
      const { text: retryResponse } = await callLLM({ system, user });
      try {
        parsed = safeParse(retryResponse);
      } catch (e2) {
        // If still failing, attempt to clean fences and parse
        const cleaned = retryResponse.replace(/```[\s\S]*?```/g, (m) => m.replace(/`/g, ''));
        parsed = safeParse(cleaned);
      }
    }
    if (!Array.isArray(parsed)) throw new Error('LLM did not return an array');
    llmFindings = parsed.map((obj: any) => ({
      source_id: obj.source_id ?? null,
      issue: obj.issue,
      quote: obj.quote,
      severity: obj.severity,
      suggestion: obj.suggestion ?? undefined,
      confidence: obj.confidence,
      ai_assisted: true,
    } as ReviewFinding));
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      // Return exact findings plus notice
      const notice: ReviewFinding = {
        source_id: null,
        issue: 'AI review unavailable, rules-only results',
        quote: '',
        severity: 'info',
        suggestion: '',
        confidence: 1,
        ai_assisted: false,
      };
      return [...exactFindings, notice];
    }
    // For any other error, rethrow – caller can handle
    throw err;
  }

  // 5. Validate LLM findings
  const validIds = new Set([...shortRules.map((r) => r.id), ...shortFacts.map((f) => f.id)]);
  const validated = llmFindings.map((f) => {
    const needsHuman = !validIds.has(f.source_id as string) || (f.confidence ?? 0) < 0.6;
    return {
      ...f,
      status: needsHuman ? 'needs_human' : 'open',
      source_id: validIds.has(f.source_id as string) ? f.source_id : null,
    } as ReviewFinding;
  });

  // 6. Claims verification
  const claimFindings = checkClaims(draft, facts as ApprovedFact[]);

  // 7. Merge all findings and dedupe
  const allFindings: ReviewFinding[] = [...exactFindings, ...validated, ...claimFindings];
  const uniq = new Map<string, ReviewFinding>();
  for (const f of allFindings) {
    const key = `${f.source_id ?? 'null'}|${f.issue}|${f.quote}`;
    if (!uniq.has(key)) uniq.set(key, f);
  }

  return Array.from(uniq.values());
}

