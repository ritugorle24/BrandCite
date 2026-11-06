/**
 * lib/config.ts
 *
 * Central configuration file for BrandCite review settings.
 * All tunable thresholds and constants live here so they can be
 * changed in one place.
 */

export const reviewConfig = {
  /**
   * Findings with confidence below this threshold are automatically
   * escalated to `needs_human` status for manual review.
   * Range: 0.0 – 1.0.  Default: 0.6
   */
  confidenceThreshold: parseFloat(
    process.env.BRANDCITE_CONFIDENCE_THRESHOLD ?? '0.6'
  ),

  /**
   * Maximum number of brand rules forwarded to the LLM prompt.
   */
  maxShortlistedRules: 12,

  /**
   * Maximum number of approved facts forwarded to the LLM prompt.
   */
  maxShortlistedFacts: 8,

  /**
   * Maximum character length accepted by POST /api/review.
   */
  maxDraftLength: 5000,
} as const;
