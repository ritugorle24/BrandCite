import { reviewDraft, ReviewFinding } from './lib/review.ts';
import { LLMUnavailableError } from './lib/llm.ts';
import * as Supabase from '@supabase/supabase-js';

// Mock Supabase client globally
function mockSupabase() {
  const mockFrom = (table: string) => {
    if (table === 'brand_rules') {
      return {
        select: () => ({ eq: async () => ({ data: [{ id: 'R-TEST-01', category: 'tone', text: 'Be friendly' }], error: null }) }),
      } as any;
    }
    if (table === 'approved_facts') {
      return {
        select: () => ({ eq: async () => ({ data: [{ id: 'F-TEST-01', category: 'legal', fact_text: 'Legal fact' }], error: null }) }),
      } as any;
    }
    return { select: () => ({ eq: async () => ({ data: [], error: null }) }) } as any;
  };
  // @ts-ignore
  Supabase.createClient = () => ({ from: mockFrom } as any);
}

// Helper to temporarily replace callLLM
function mockCallLLM(response: any, shouldReject = false, rejectWith?: any) {
  // @ts-ignore
  const llmModule = require('./lib/llm.ts');
  llmModule.callLLM = async () => {
    if (shouldReject) throw rejectWith;
    return { text: response, provider: 'primary' };
  };
}

async function runScenario(name: string, draft: string, llmSetup: () => void) {
  console.log(`\n=== Scenario: ${name} ===`);
  llmSetup();
  const results = await reviewDraft(draft);
  console.log('Findings:', results);
}

(async () => {
  mockSupabase();

  const draft = 'Our coffee is the best and 100% organic. Hey guys, buy now!';

  // 1. Valid fake source_id
  await runScenario('valid source', draft, () => {
    mockCallLLM('[{"source_id":"R-TEST-01","issue":"test issue","quote":"best","severity":"high","suggestion":null,"confidence":0.9}]');
  });

  // 2. Invalid JSON then retry
  let first = true;
  // @ts-ignore
  const llmModule = require('./lib/llm.ts');
  llmModule.callLLM = async () => {
    if (first) {
      first = false;
      return { text: '```json\n[ { "source_id": "R-TEST-01", "issue": "bad" }', provider: 'primary' };
    }
    return { text: '[{"source_id":"R-TEST-01","issue":"fixed","quote":"organic","severity":"high","suggestion":null,"confidence":0.95}]', provider: 'primary' };
  };
  await runScenario('invalid JSON retry', draft, () => {});

  // 3. Low confidence
  await runScenario('low confidence', draft, () => {
    mockCallLLM('[{"source_id":"R-TEST-01","issue":"low confidence","quote":"guys","severity":"high","suggestion":null,"confidence":0.4}]');
  });

  // 4. LLM unavailable (both providers off)
  await runScenario('LLM unavailable', draft, () => {
    // @ts-ignore
    const llm = require('./lib/llm.ts');
    llm.callLLM = async () => {
      throw new LLMUnavailableError('p', 'f');
    };
  });
})();
