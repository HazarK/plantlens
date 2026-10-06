import { z } from "zod";

/*
 * Certainty is categorical rather than a fake numerical probability.
 */
const certaintySchema = z.enum([
  "low",
  "medium",
  "high",
]);

/*
 * One meaningful change between the two observations.
 */
const semanticChangeSchema = z.object({
  /*
   * What aspect of the plant changed?
   *
   * Examples:
   * "leaf yellowing"
   * "visible wilting"
   * "new growth"
   */
  aspect: z.string(),

  /*
   * How did that aspect change?
   */
  direction: z.enum([
    "improved",
    "worsened",
    "new",
    "resolved",
    "unchanged",
    "uncertain",
  ]),

  /*
   * Evidence must come from the previous structured observation.
   *
   * null is allowed when the previous observation did not provide
   * reliable evidence for this aspect.
   */
  previous_evidence: z.string().nullable(),

  /*
   * Evidence from the current structured observation.
   */
  current_evidence: z.string().nullable(),

  certainty: certaintySchema,
});

/*
 * Complete semantic longitudinal comparison.
 */
export const plantComparisonSchema = z.object({
  /*
   * This is the AI's overall semantic trend assessment.
   *
   * "mixed" is important because one thing may improve while
   * another gets worse.
   */
  trend: z.enum([
    "improving",
    "stable",
    "worsening",
    "mixed",
    "uncertain",
  ]),

  trend_certainty: certaintySchema,

  changes: z.array(semanticChangeSchema),

  /*
   * Short user-facing explanation.
   */
  summary: z.string(),

  /*
   * Reasons the comparison may be unreliable.
   *
   * Example:
   * "The observations describe different parts of the plant."
   */
  limitations: z.array(z.string()),

  /*
   * Escalation signal for comparisons that should not be
   * presented confidently.
   */
  needs_review: z.boolean(),

  review_reason: z.string().nullable(),
});

export type PlantComparison = z.infer<
  typeof plantComparisonSchema
>;