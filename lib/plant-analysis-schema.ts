import { z } from "zod";

const certaintySchema = z.enum(["low", "medium", "high"]);

/*
 * One directly visible observation from the photograph. This layer should describe evidence, not explain its cause.
 * Good:"Two lower leaves contain yellow areas." . Bad: "The plant has been overwatered." 
 */
const visibleObservationSchema = z.object({
  observation: z.string(),
  certainty: certaintySchema,
});

/*
 * An issue is an INTERPRETATION of the visible evidence.
 * Requiring evidence makes the model explain what in the photograph caused it to consider this issue.
 */
const possibleIssueSchema = z.object({
  issue: z.string(),
  evidence: z.string(),
  certainty: certaintySchema,
});

/*
 * Recommendations are kept separate from observations and issues.
 * "basis" tells us what kind of reasoning supports the recommendation.
 * visible_evidence: The action follows fairly directly from something visible.
 * reasonable_inference: The photograph suggests it, but does not prove it.
 * missing_information: The safest recommendation is to check something before acting.
 */
const recommendationSchema = z.object({
  action: z.string(),
  reason: z.string(),
  certainty: certaintySchema,
  basis: z.enum([
    "visible_evidence",
    "reasonable_inference",
    "missing_information",
  ]),
});

/* This is the complete PlantLens V1 AI contract. */
export const plantAnalysisSchema = z.object({
  /*
   * null is allowed because sometimes species identification
   * is simply not reliable from the photograph.
   */
  likely_species: z.string().nullable(),

  identification_certainty: certaintySchema,

  /*
   * "uncertain" prevents us from forcing the model to classify
   * an image when the available evidence is inadequate.
   */
  status: z.enum([
    "healthy",
    "watch",
    "needs_attention",
    "uncertain", 
  ]),

  visible_observations: z.array(visibleObservationSchema),

  possible_issues: z.array(possibleIssueSchema),

  recommendations: z.array(recommendationSchema),

  /*
   * Context that would materially improve the recommendation.
   * Examples: "When was the plant last watered?" "Does the pot have drainage holes?"
   */
  questions_or_missing_information: z.array(z.string()),

  /* Short user-facing synthesis. */
  summary: z.string(),

  /* Human escalation signal.*/
  needs_review: z.boolean(),

  /*
   * null when review is not needed.
   */
  review_reason: z.string().nullable(),
});

/* TypeScript can automatically derive the PlantAnalysis type from our schema. */
export type PlantAnalysis = z.infer<typeof plantAnalysisSchema>;