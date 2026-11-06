import { NextRequest, NextResponse } from 'next/server';
import { reviewDraft } from '../../../lib/review.ts';
import { LLMUnavailableError } from '../../../lib/llm.ts';
import { reviewConfig } from '../../../lib/config.ts';

// ─── Constants ───────────────────────────────────────────────
const MAX_TEXT_LENGTH = reviewConfig.maxDraftLength;

// ─── POST /api/review ────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object.' },
      { status: 400 }
    );
  }

  const { text } = body as Record<string, unknown>;

  // 2. Validate `text`
  if (text === undefined || text === null) {
    return NextResponse.json(
      { error: 'Missing required field: text.' },
      { status: 400 }
    );
  }

  if (typeof text !== 'string') {
    return NextResponse.json(
      { error: 'Field "text" must be a string.' },
      { status: 400 }
    );
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return NextResponse.json(
      { error: 'Field "text" must not be empty.' },
      { status: 400 }
    );
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `Field "text" exceeds the maximum allowed length of ${MAX_TEXT_LENGTH} characters (got ${trimmed.length}).`,
      },
      { status: 422 }
    );
  }

  // 3. Run review
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
        { error: 'Both LLM providers are currently unavailable. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('[api/review] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An internal error occurred while processing the review.' },
      { status: 500 }
    );
  }

  // 4. Return — no DB writes
  return NextResponse.json(
    { findings, provider, notice },
    { status: 200 }
  );
}
