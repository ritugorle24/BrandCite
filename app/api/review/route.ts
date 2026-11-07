import { NextRequest, NextResponse } from 'next/server';
import { reviewDraft } from '../../../lib/review.ts';
import { LLMUnavailableError } from '../../../lib/llm.ts';
import { reviewConfig } from '../../../lib/config.ts';
import { checkRateLimit } from '../../../lib/rateLimit.ts';

// ─── Constants ───────────────────────────────────────────────
const MAX_TEXT_LENGTH = reviewConfig.maxDraftLength; // 5000 chars

// ─── POST /api/review ────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limiting (30 requests per minute per client)
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous-client';

  const rateCheck = checkRateLimit(`review:${clientIp}`, 30, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please wait a moment before submitting again.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object.', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { text } = body as Record<string, unknown>;

  // 3. Validate `text`
  if (text === undefined || text === null) {
    return NextResponse.json(
      { error: 'Missing required field: text.', code: 'MISSING_FIELD' },
      { status: 400 }
    );
  }

  if (typeof text !== 'string') {
    return NextResponse.json(
      { error: 'Field "text" must be a string.', code: 'INVALID_TYPE' },
      { status: 400 }
    );
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return NextResponse.json(
      { error: 'Field "text" must not be empty.', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `Field "text" exceeds the maximum allowed length of ${MAX_TEXT_LENGTH} characters (got ${trimmed.length}).`,
        code: 'INPUT_TOO_LONG',
      },
      { status: 422 }
    );
  }

  // 4. Run review
  let findings;
  let provider: string | null = null;
  let notice: string | null = null;

  try {
    findings = await reviewDraft(trimmed);

    // Determine provider from the findings (AI findings carry ai_assisted: true)
    const hasAI = findings.some((f) => f.ai_assisted);
    provider = hasAI ? 'primary_or_fallback' : null;

    // Surface the AI-unavailable notice if present
    const noticeFinding = findings.find((f) =>
      f.issue?.includes('AI review unavailable')
    );
    if (noticeFinding) {
      notice = noticeFinding.issue;
      provider = null;
    }
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      return NextResponse.json(
        {
          error: 'Both LLM providers are currently unavailable. Please try again later.',
          code: 'LLM_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    console.error('[api/review] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'An internal error occurred while processing the review.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }

  // 5. Return — no DB writes
  return NextResponse.json(
    { findings, provider, notice },
    { status: 200 }
  );
}
