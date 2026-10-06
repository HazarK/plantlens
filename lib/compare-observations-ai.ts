import Groq from "groq-sdk";
import { z } from "zod";

import type {
  PlantAnalysis,
} from "@/lib/plant-analysis-schema";

import {
  plantComparisonSchema,
  type PlantComparison,
} from "@/lib/plant-comparison-schema";

import {
  PLANT_ANALYSIS_MODEL,
} from "@/lib/plant-analysis-config";

/*
 * For V1 we deliberately reuse the same Groq model.
 *
 * Later, evaluation may show that this text-only comparison
 * can use a smaller/cheaper model.
 */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function compareObservationsSemantically(
  previous: PlantAnalysis,
  current: PlantAnalysis
): Promise<PlantComparison> {
  const completion =
    await groq.chat.completions.create({
      model: PLANT_ANALYSIS_MODEL,

      messages: [
        {
          role: "system",
          content: `
You are the longitudinal comparison component of PlantLens.

You are NOT analyzing photographs.

You are given exactly TWO structured plant observations:

1. previous observation
2. current observation

Compare only the information contained in those structured observations.

IMPORTANT RULES

1. Do not invent visual information that is absent from the observations.

2. Do not assume that something disappeared merely because the current
   observation does not mention it.

   Absence of mention is NOT evidence that an issue resolved.

3. Use "resolved" only when the current observation contains evidence
   that the previously visible issue is no longer visible.

4. Use "new" conservatively.

   Do not claim something is newly present merely because the previous
   observation failed to mention it.

5. Compare semantically equivalent observations even when wording differs.

   Example:

   Previous:
   "Several lower leaves contain yellow areas."

   Current:
   "Only one lower leaf shows mild yellowing."

   This may reasonably indicate reduced yellowing.

6. Recommendations are NOT visual evidence.

   Do not treat changes in recommendations as changes in plant health.

7. questions_or_missing_information are NOT plant-health changes.

8. A change in likely_species is not itself a health improvement or decline.

9. possible_issues are interpretations, not direct evidence.
   Prefer visible_observations when determining what changed.

10. Status values may support the comparison but should not override
    contradictory visual evidence.

11. If some evidence improves and other evidence worsens, use trend = "mixed".

12. If the observations are too different, incomplete, or ambiguous for a
    reliable comparison, use trend = "uncertain".

13. Every claimed change must include evidence from the observations.

14. Keep the summary cautious.

Good:
"The plant appears somewhat improved, with less visible yellowing,
although the comparison is limited by differences in what was described."

Bad:
"The plant has fully recovered."

Never claim information beyond the two supplied structured observations.
          `.trim(),
        },

        {
          role: "user",
          content: `
Compare these two PlantLens observations.

PREVIOUS OBSERVATION:

${JSON.stringify(previous, null, 2)}

CURRENT OBSERVATION:

${JSON.stringify(current, null, 2)}
          `.trim(),
        },
      ],

      /*
       * Just like our image-analysis endpoint, require a strict,
       * predictable JSON response.
       */
      response_format: {
        type: "json_schema",

        json_schema: {
          name: "plant_longitudinal_comparison",

          strict: true,

          schema: z.toJSONSchema(
            plantComparisonSchema
          ),
        },
      },

      max_completion_tokens: 1200,
    });

  const rawResponse =
    completion.choices[0]?.message?.content;

  if (!rawResponse) {
    throw new Error(
      "Groq returned no semantic comparison."
    );
  }

  /*
   * Parse the JSON and validate it again at our own
   * application boundary.
   */
  const parsedResponse =
    JSON.parse(rawResponse);

  return plantComparisonSchema.parse(
    parsedResponse
  );
}