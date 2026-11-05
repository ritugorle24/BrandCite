/**
 * Quick smoke-test for the LLM client.
 *
 * Usage:
 *   npx tsx scripts/test-llm.ts
 *
 * Requires a .env (or .env.local) with at least LLM_PRIMARY_KEY set.
 */

// Load .env / .env.local so keys are available outside Next.js
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { callLLM, LLMUnavailableError } from "@/lib/llm";

async function main() {
  console.log("── LLM smoke-test ──\n");

  try {
    const { text, provider } = await callLLM({
      system: "You are a helpful assistant. Reply in one short sentence.",
      user: "What is the capital of France?",
    });

    console.log(`Provider : ${provider}`);
    console.log(`Reply    : ${text}\n`);
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      console.error("Both providers failed.");
      console.error("  Primary :", (err.primaryError as Error)?.message ?? err.primaryError);
      console.error("  Fallback:", (err.fallbackError as Error)?.message ?? err.fallbackError);
      process.exit(1);
    }
    throw err;
  }
}

main();
