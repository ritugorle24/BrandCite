import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

const { reviewDraft } = await import("../lib/review.ts");

interface Sample {
  id: string;
  label: string;
  draft: string;
  expected_issues: string[];
  expected_quotes: string[];
}

const samples: Sample[] = JSON.parse(
  readFileSync(resolve(__dirname, "../data/samples.json"), "utf-8")
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const { data: rules, error: rulesError } = await supabase
  .from("brand_rules")
  .select("id");

const { data: facts, error: factsError } = await supabase
  .from("approved_facts")
  .select("id");

if (rulesError || factsError) {
  throw new Error("Could not load valid source IDs from Supabase.");
}

const validSourceIds = new Set([
  ...(rules ?? []).map((r) => r.id),
  ...(facts ?? []).map((f) => f.id),
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-‒–—]/g, "-")
    .trim();
}

const bannedQuotes = [
  "guys",
  "Nova Brew",
  "boosts immunity",
  "improves focus",
  "number one",
  "cheap",
  "ladies and gentlemen",
  "worlds best",
  "novabrew",
];

function expectedType(quote: string): string {
  return bannedQuotes.some((q) => normalize(q) === normalize(quote))
    ? "banned term used"
    : "unsupported absolute claim";
}

let expectedTotal = 0;
let detectedTotal = 0;
let groundedTotal = 0;
let findingTotal = 0;
let cleanPassed = 0;
let cleanFailed = 0;
let failedSamples = 0;

console.log("\n========== BRANDCITE SAMPLE EVALUATION ==========\n");

for (const sample of samples) {
  console.log(`[${sample.id}] ${sample.label}`);

  let findings;

  try {
    findings = await reviewDraft(sample.draft);
  } catch (error) {
    console.log("ERROR:", error);
    failedSamples++;
    continue;
  }

  const realFindings = findings.filter(
    (f) => !f.issue?.includes("AI review unavailable")
  );

  findingTotal += realFindings.length;

  for (const f of realFindings) {
    const grounded =
      (f.source_id !== null && validSourceIds.has(f.source_id)) ||
      f.status === "needs_human";

    if (grounded) groundedTotal++;

    console.log(
      `  ${grounded ? "GROUNDED" : "UNGROUNDED"} | ${f.issue} | "${f.quote}" | source=${f.source_id ?? "null"} | status=${f.status ?? "-"}`
    );
  }

  if (sample.expected_quotes.length === 0) {
    if (realFindings.length === 0) {
      cleanPassed++;
      console.log("  PASS: clean draft has no findings");
    } else {
      cleanFailed++;
      console.log("  FAIL: unexpected findings in clean draft");
    }
    console.log();
    continue;
  }

  for (const quote of sample.expected_quotes) {
    expectedTotal++;

    const type = expectedType(quote);

    const found = realFindings.some(
      (f) =>
        normalize(f.issue) === normalize(type) &&
        normalize(f.quote).includes(normalize(quote))
    );

    if (found) {
      detectedTotal++;
      console.log(`  PASS: "${quote}" -> ${type}`);
    } else {
      console.log(`  MISS: "${quote}" -> ${type}`);
    }
  }

  console.log();
}

const recall = expectedTotal
  ? (detectedTotal / expectedTotal) * 100
  : 100;

const grounding = findingTotal
  ? (groundedTotal / findingTotal) * 100
  : 100;

console.log("================================================");
console.log("TOTALS");
console.log("================================================");
console.log(`Samples:             ${samples.length}`);
console.log(`Expected detections: ${expectedTotal}`);
console.log(`Detected:            ${detectedTotal}`);
console.log(`Missed:              ${expectedTotal - detectedTotal}`);
console.log(`Exact-type recall:   ${recall.toFixed(1)}%`);
console.log(`Clean drafts passed: ${cleanPassed}/2`);
console.log(`Clean drafts failed: ${cleanFailed}`);
console.log(`Total findings:      ${findingTotal}`);
console.log(`Validly grounded:    ${groundedTotal}/${findingTotal}`);
console.log(`Grounding rate:      ${grounding.toFixed(1)}%`);
console.log(`Evaluation errors:   ${failedSamples}`);
console.log("================================================");

if (recall >= 70 && grounding === 100 && cleanFailed === 0 && failedSamples === 0) {
  console.log("ACCEPTANCE CHECK: PASS");
} else {
  console.log("ACCEPTANCE CHECK: NEEDS ATTENTION");
}
