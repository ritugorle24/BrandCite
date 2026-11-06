import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * scripts/seed-decisions.ts
 *
 * Populates the `findings` table with realistic accept/reject decisions for
 * existing sample drafts. This provides data for the `/api/insights/gaps`
 * dashboard.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceKey) {
  console.error('Supabase URL or service key missing from env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Helper to randomly pick a status based on a simple probability model.
function randomDecision(): 'open' | 'rejected' {
  // 70% chance of acceptance (open), 30% rejection.
  return Math.random() < 0.7 ? 'open' : 'rejected';
}

async function seed() {
  // 1️⃣ Fetch a handful of sample findings that are currently in `needs_human`.
  const { data: pending, error } = await supabase
    .from('findings')
    .select('id, source_id')
    .eq('status', 'needs_human')
    .limit(100);

  if (error) {
    console.error('Failed to fetch pending findings:', error);
    return;
  }

  if (!pending || pending.length === 0) {
    console.log('No pending findings to seed.');
    return;
  }

  // 2️⃣ For each pending finding, decide to accept or reject.
  for (const f of pending) {
    const decision = randomDecision();
    const update = await supabase
      .from('findings')
      .update({
        status: decision,
        reviewed_by: '00000000-0000-0000-0000-000000000001', // placeholder admin id
        reviewed_at: new Date().toISOString(),
        resolution_note: decision === 'rejected' ? 'Automated seed reject' : null,
        escalation_reason: null,
      })
      .eq('id', f.id);

    if (update.error) {
      console.error(`Failed to update finding ${f.id}:`, update.error);
    }
  }

  console.log(`Seeded ${pending.length} decisions.`);
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error('Unexpected error during seeding:', e);
  process.exit(1);
});
