import { z } from "zod";

/*
 * This schema represents GENERAL species care guidance.
 *
 * It is deliberately separate from PlantAnalysis,
 * which represents the visible state of one plant
 * at one moment in time.
 */

export const plantCareProfileSchema = z.object({
  /*
   * Species used to generate this profile.
   *
   * This should come from the human-confirmed Plant species,
   * not a new AI identification attempt.
   */
  species: z.string(),

  /*
   * Useful human-readable names, when reasonably known.
   */
  common_names: z.array(z.string()),

  /*
   * Short general introduction to the species.
   */
  overview: z.string(),

  light: z.object({
    requirement: z.enum([
      "low",
      "medium",
      "bright_indirect",
      "partial_direct",
      "full_sun",
      "varied",
    ]),

    guidance: z.string(),

    /*
     * Particularly useful for our current Berlin balcony setup.
     */
    afternoon_sun_guidance: z.string(),
  }),

  watering: z.object({
    preference: z.enum([
      "low",
      "moderate",
      "high",
    ]),

    /*
     * Prefer substrate/plant signals rather than blindly
     * recommending a calendar schedule.
     */
    guidance: z.string(),

    before_watering_check: z.string(),
  }),

  fertilizer: z.object({
    /*
     * Example:
     * "Approximately every 4–6 weeks during active growth."
     *
     * This is general species guidance, NOT a claim that
     * the current plant needs fertilizer now.
     */
    growing_season_cadence: z.string(),

    winter_guidance: z.string(),

    guidance: z.string(),
  }),

  placement: z.object({
    indoor_suitability: z.enum([
      "good",
      "conditional",
      "poor",
    ]),

    outdoor_suitability: z.enum([
      "good",
      "seasonal",
      "conditional",
      "poor",
    ]),

    guidance: z.string(),
  }),

  temperature: z.object({
    cold_sensitivity: z.enum([
      "low",
      "medium",
      "high",
    ]),

    guidance: z.string(),
  }),

  humidity: z.object({
    preference: z.enum([
      "low",
      "average",
      "high",
    ]),

    guidance: z.string(),
  }),

  repotting: z.object({
    guidance: z.string(),

    /*
     * Observable/user-checkable signals that might justify
     * repotting rather than an arbitrary calendar deadline.
     */
    signs_to_watch_for: z.array(z.string()),
  }),

  common_issues: z.array(
    z.object({
      issue: z.string(),
      watch_for: z.string(),
    })
  ),

  /*
   * Now combine species requirements with THIS plant's
   * growing environment.
   */
  growing_context_assessment: z.object({
    fit: z.enum([
      "good",
      "conditional",
      "poor",
      "uncertain",
    ]),

    summary: z.string(),

    seasonal_notes: z.array(z.string()),
  }),

  /*
   * Miscellaneous useful species-specific care advice.
   */
  useful_notes: z.array(z.string()),

  /*
   * Explicitly preserve things that cannot be stated
   * confidently.
   */
  uncertainties: z.array(z.string()),
});

export type PlantCareProfile = z.infer<
  typeof plantCareProfileSchema
>;