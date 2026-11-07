import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runExactChecks } from "../lib/exactChecks.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
  console.error("Supabase URL or service key missing from env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

interface Sample {
  id: string;
  label: string;
  draft: string;
  expected_issues: string[];
  expected_quotes: string[];
}

/**
 * Predetermined decision model to produce realistic and consistent data.
 * Certain rules (e.g. R-CLAI-01) represent rules frequently disputed by authors
 * (rejection rate >= 50% and flagged >= 3 times), making them "possibly unclear".
 * Other rules have higher acceptance rates (compliance).
 */
function getRealisticDecision(ruleId: string | null, sampleId: string, index: number): {
  status: 'accepted' | 'rejected';
  note: string;
} {
  // R-CLAI-01: Claims rule often rejected by creators claiming context is valid
  if (ruleId === 'R-CLAI-01') {
    // ~65% rejection rate -> flagged >= 3 and rejection_rate >= 0.5 -> possibly_unclear = true
    const isRejected = (index + sampleId.charCodeAt(sampleId.length - 1)) % 10 < 7;
    return isRejected
      ? {
          status: 'rejected',
          note: 'Author dispute: claim is substantiated by recent internal marketing study.',
        }
      : {
          status: 'accepted',
          note: 'Author accepted: removed absolute claim in favor of verified statement.',
        };
  }

  // R-CLAI-02: Superlatives (number one, worlds best)
  if (ruleId === 'R-CLAI-02') {
    // 50% rejection
    const isRejected = index < 5;
    return isRejected
      ? {
          status: 'rejected',
          note: 'Author dispute: cited external industry award from prior quarter.',
        }
      : {
          status: 'accepted',
          note: 'Author accepted: qualified superlative with study citation.',
        };
  }

  // R-TONE-03: Gendered greetings ("guys", "ladies and gentlemen")
  if (ruleId === 'R-TONE-03') {
    // 80% accepted
    const isRejected = index < 2;
    return isRejected
      ? {
          status: 'rejected',
          note: 'Author dispute: informal audience segment allows colloquial greeting.',
        }
      : {
          status: 'accepted',
          note: 'Author accepted: switched greeting to "folks" / "everyone".',
        };
  }

  // R-CLAI-03: Health / medical claims strictly enforced
  if (ruleId === 'R-CLAI-03') {
    // 100% accepted
    return {
      status: 'accepted',
      note: 'Author accepted: removed unauthorized health and wellness claim.',
    };
  }

  // R-TERM-01: NovaBrew trademark capitalization & spacing
  if (ruleId === 'R-TERM-01') {
    // ~35% rejected, 65% accepted
    const isRejected = (index + sampleId.charCodeAt(sampleId.length - 1)) % 3 === 0;
    return isRejected
      ? {
          status: 'rejected',
          note: 'Author dispute: stylistic choice for headline presentation.',
        }
      : {
          status: 'accepted',
          note: 'Author accepted: corrected brand capitalization to NovaBrew.',
        };
  }

  // Default: 75% accepted, 25% rejected
  const isRejected = (index + 1) % 4 === 0;
  return isRejected
    ? {
        status: 'rejected',
        note: 'Author dispute: copy verified against localized campaign guidelines.',
      }
    : {
        status: 'accepted',
        note: 'Author accepted: applied suggested guideline fix.',
      };
}

async function main() {
  console.log("Starting seed-decisions script...");

  // 1. Fetch user profiles for author and reviewer
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, role");

  if (profileErr || !profiles || profiles.length === 0) {
    console.error("Failed to load profiles:", profileErr);
    process.exit(1);
  }

  const creator = profiles.find((p) => p.role === "creator") ?? profiles[0];
  const reviewer =
    profiles.find((p) => ["manager", "admin"].includes(p.role)) ?? profiles[0];

  console.log(`Using creator: ${creator.email} (${creator.id})`);
  console.log(`Using reviewer: ${reviewer.email} (${reviewer.id})`);

  // 2. Fetch rules and terms from DB
  const { data: rules, error: rulesErr } = await supabase
    .from("brand_rules")
    .select("id, category, text");

  const { data: terms, error: termsErr } = await supabase
    .from("terms")
    .select("*");

  if (rulesErr || termsErr) {
    console.error("Failed to load brand rules or terms:", rulesErr || termsErr);
    process.exit(1);
  }

  // 3. Load samples from data/samples.json
  const samplesPath = resolve(__dirname, "../data/samples.json");
  const samples: Sample[] = JSON.parse(readFileSync(samplesPath, "utf-8"));
  console.log(`Loaded ${samples.length} samples from data/samples.json.`);

  // 4. Ensure sample drafts exist in database
  let createdDraftCount = 0;
  const sampleDraftIds: string[] = [];

  for (const s of samples) {
    const title = `Sample [${s.id}] ${s.label}`;

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from("drafts")
      .select("id")
      .eq("title", title)
      .maybeSingle();

    let draftId = existingDraft?.id;

    if (!draftId) {
      const { data: newDraft, error: draftErr } = await supabase
        .from("drafts")
        .insert({
          author_id: creator.id,
          title,
          status: "in_review",
        })
        .select("id")
        .single();

      if (draftErr || !newDraft) {
        console.error(`Failed to create draft for ${s.id}:`, draftErr);
        continue;
      }

      draftId = newDraft.id;
      createdDraftCount++;

      // Create version 1
      await supabase.from("draft_versions").insert({
        draft_id: draftId,
        version_no: 1,
        content: s.draft,
        created_by: creator.id,
      });

      // Generate findings via exact checks
      const exactFindings = await runExactChecks(
        s.draft,
        terms ?? [],
        rules ?? []
      );

      const insertFindings = exactFindings.map((f) => ({
        draft_id: draftId,
        version_no: 1,
        source_id: f.source_id,
        issue: f.issue,
        quote: f.quote,
        severity: f.severity,
        suggestion: f.suggestion,
        confidence: f.confidence,
        status: "open",
      }));

      if (insertFindings.length > 0) {
        await supabase.from("findings").insert(insertFindings);
      }
    }

    if (draftId) {
      sampleDraftIds.push(draftId);
    }
  }

  console.log(
    `Sample drafts check completed: ${createdDraftCount} newly created, ${sampleDraftIds.length} total sample drafts.`
  );

  // 5. Fetch all findings for these sample drafts
  const { data: findings, error: findingsErr } = await supabase
    .from("findings")
    .select("id, draft_id, source_id, issue, quote, status")
    .in("draft_id", sampleDraftIds);

  if (findingsErr) {
    console.error("Failed to fetch findings for sample drafts:", findingsErr);
    process.exit(1);
  }

  console.log(`Found ${findings?.length ?? 0} findings on sample drafts to seed decisions.`);

  let acceptedCount = 0;
  let rejectedCount = 0;

  // 6. Apply realistic decisions using a separate counter for each rule
  const ruleOccurrenceCounts = new Map<string, number>();

  for (let i = 0; i < (findings ?? []).length; i++) {
    const f = findings![i];

    const ruleKey = f.source_id ?? "__null__";
    const ruleIndex = ruleOccurrenceCounts.get(ruleKey) ?? 0;
    ruleOccurrenceCounts.set(ruleKey, ruleIndex + 1);

    const { status, note } = getRealisticDecision(
      f.source_id,
      f.draft_id,
      ruleIndex
    );

    //

    const { error: updateErr } = await supabase
      .from("findings")
      .update({
        status,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", f.id);

    if (updateErr) {
      console.error(`Failed to update finding ${f.id}:`, updateErr);
    } else {
      if (status === "accepted") acceptedCount++;
      if (status === "rejected") rejectedCount++;
    }
  }

  console.log("\n========== SEED DECISIONS COMPLETED ==========");
  console.log(`Total sample findings updated: ${(findings ?? []).length}`);
  console.log(`Decisions accepted:            ${acceptedCount}`);
  console.log(`Decisions rejected:            ${rejectedCount}`);
  console.log("==============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Unexpected error in seed-decisions:", e);
    process.exit(1);
  });





