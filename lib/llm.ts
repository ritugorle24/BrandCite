/**
 * LLM client — calls an OpenAI-compatible chat completions endpoint.
 *
 * Primary:  Gemini  (via generativelanguage.googleapis.com)
 * Fallback: Groq    (via api.groq.com)
 *
 * Config is read from env vars; API keys are NEVER logged.
 */

// ─── Types ───────────────────────────────────────────────────

export interface CallLLMParams {
  system: string;
  user: string;
}

export interface CallLLMResult {
  text: string;
  provider: "primary" | "fallback";
}

export class LLMUnavailableError extends Error {
  public readonly primaryError: unknown;
  public readonly fallbackError: unknown;

  constructor(primaryError: unknown, fallbackError: unknown) {
    super(
      "Both LLM providers failed. Primary and fallback are unavailable."
    );
    this.name = "LLMUnavailableError";
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

// ─── Internal helpers ────────────────────────────────────────

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getPrimaryConfig(): ProviderConfig {
  const baseUrl =
    process.env.LLM_PRIMARY_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/";
  const apiKey = process.env.LLM_PRIMARY_KEY ?? "";
  const model = process.env.LLM_PRIMARY_MODEL ?? "gemini-2.0-flash";

  if (!apiKey) throw new Error("LLM_PRIMARY_KEY is not set");
  return { baseUrl, apiKey, model };
}

function getFallbackConfig(): ProviderConfig {
  const baseUrl =
    process.env.LLM_FALLBACK_BASE_URL ?? "https://api.groq.com/openai/v1";
  const apiKey = process.env.LLM_FALLBACK_KEY ?? "";
  const model =
    process.env.LLM_FALLBACK_MODEL ?? "llama-3.3-70b-versatile";

  if (!apiKey) throw new Error("LLM_FALLBACK_KEY is not set");
  return { baseUrl, apiKey, model };
}

/** Normalise base URL so it always ends with `/chat/completions`. */
function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

/** Safe label for logs — never includes keys or full prompts. */
function safeLabel(cfg: ProviderConfig): string {
  return `${cfg.model} @ ${new URL(cfg.baseUrl).hostname}`;
}

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2; // 1 initial + 1 retry

/**
 * Fire one chat-completion request.
 * Throws on network error, non-2xx status, or timeout.
 */
async function chatCompletion(
  cfg: ProviderConfig,
  system: string,
  user: string
): Promise<string> {
  const url = completionsUrl(cfg.baseUrl);

  const body = JSON.stringify({
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const status = res.status;
      // Read a short excerpt of the error body for diagnostics
      const errBody = await res.text().catch(() => "(unreadable)");
      const excerpt = errBody.slice(0, 200);
      throw Object.assign(
        new Error(`HTTP ${status} from ${safeLabel(cfg)}: ${excerpt}`),
        { status }
      );
    }

    const json = await res.json();
    const text: string | undefined =
      json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error(
        `Empty response from ${safeLabel(cfg)}: ${JSON.stringify(json).slice(0, 200)}`
      );
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try a provider up to MAX_ATTEMPTS times.
 * Returns the text on success, or throws the last error.
 * A 429 is thrown immediately (no retry) so the caller can fall back.
 */
async function tryProvider(
  cfg: ProviderConfig,
  system: string,
  user: string
): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await chatCompletion(cfg, system, user);
    } catch (err: unknown) {
      lastErr = err;

      // 429 → don't retry, let caller fall back right away
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 429) {
        console.warn(`[llm] 429 rate-limited on ${safeLabel(cfg)} — skipping retries`);
        throw err;
      }

      console.warn(
        `[llm] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${safeLabel(cfg)}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw lastErr;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Call an OpenAI-compatible LLM with automatic fallback.
 *
 * 1. Try the **primary** provider (with 1 retry).
 * 2. If it fails or returns 429, try the **fallback** provider (with 1 retry).
 * 3. If both fail, throw `LLMUnavailableError`.
 *
 * @returns `{ text, provider }` — the completion text and which provider served it.
 */
export async function callLLM({
  system,
  user,
}: CallLLMParams): Promise<CallLLMResult> {
  // ── Primary ──
  let primaryError: unknown;
  try {
    const primary = getPrimaryConfig();
    const text = await tryProvider(primary, system, user);
    return { text, provider: "primary" };
  } catch (err) {
    primaryError = err;
    console.warn(
      `[llm] Primary failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Fallback ──
  let fallbackError: unknown;
  try {
    const fallback = getFallbackConfig();
    const text = await tryProvider(fallback, system, user);
    return { text, provider: "fallback" };
  } catch (err) {
    fallbackError = err;
    console.warn(
      `[llm] Fallback failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  throw new LLMUnavailableError(primaryError, fallbackError);
}
