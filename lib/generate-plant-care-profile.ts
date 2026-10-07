import Groq from "groq-sdk";
import { z } from "zod";

import {
  plantCareProfileSchema,
  type PlantCareProfile,
} from "@/lib/plant-care-profile-schema";

import {
  PLANT_ANALYSIS_MODEL,
} from "@/lib/plant-analysis-config";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type CareProfileInput = {
  confirmedSpecies: string;

  locationCity: string | null;
  locationCountry: string | null;

  placement:
    | "indoor"
    | "balcony"
    | "outdoor"
    | null;

  lightExposure:
    | "low"
    | "indirect"
    | "morning_sun"
    | "afternoon_sun"
    | "full_sun"
    | "mixed"
    | "unknown"
    | null;
};

export async function generatePlantCareProfile(
  input: CareProfileInput
): Promise<PlantCareProfile> {
  const completion =
    await groq.chat.completions.create({
      model: PLANT_ANALYSIS_MODEL,

      messages: [
        {
          role: "system",
          content: `
You generate general care profiles for PlantLens.

The plant species supplied to you has already been confirmed by the human.

You are NOT identifying the species.
You are NOT analyzing a photograph.
You are NOT diagnosing the current plant.

Your task is to provide conservative, useful GENERAL care guidance for
the confirmed species and assess how that guidance relates to the
provided growing context.

IMPORTANT RULES

1. Keep species-level care guidance separate from the condition of the
   user's individual plant.

2. Never claim that the user's plant currently needs water, fertilizer,
   repotting, or another intervention.

3. For watering, prefer physical checks of the substrate and plant over
   rigid calendar schedules.

4. Fertilizer cadence is GENERAL guidance only.
   Do not prescribe an exact product dose.
   The user should still follow the fertilizer manufacturer's label.

5. Distinguish active growing-season fertilizer guidance from lower-light
   or slower-growth periods.

6. When discussing outdoor suitability, consider that the supplied city
   may have seasonal temperature changes.

7. Do not claim access to current weather or forecasts.

8. If the location is Berlin, Germany:
   - account for a temperate climate with cold winters,
   - distinguish summer balcony suitability from year-round outdoor suitability,
   - consider frost/cold sensitivity where relevant.

9. Afternoon direct sun may be significantly stronger than indirect light.
   Mention acclimation or scorching risk when relevant to the species.

10. Do not infer the user's actual soil moisture, root health, nutrient
    status, pot size, or current fertilizer needs.

11. Do not invent precise requirements when reliable general guidance
    varies substantially by cultivar or conditions. Put uncertainty into
    the uncertainties field.

12. Keep the advice practical and understandable rather than overly technical.
13. Keep the care profile concise and suitable for display in a consumer app.

14. Keep individual guidance fields to approximately 1–3 short sentences.

15. Return no more than:
    - 4 common_issues
    - 4 useful_notes
    - 3 uncertainties
    - 3 seasonal_notes
    - 4 repotting signs_to_watch_for

16. Prefer concise practical guidance over detailed botanical explanations.

17. Treat growing_context_assessment.fit as follows:

    good:
    The supplied placement and light conditions broadly suit the species
    without important seasonal or environmental caveats.

    conditional:
    The setup can work, but requires seasonal changes, acclimation,
    protection, shading, relocation, or other meaningful precautions.

    poor:
    The supplied setup is generally unsuitable even with reasonable
    adjustments.

    uncertain:
    There is not enough information to assess the fit.

18. If a balcony setup works seasonally but not year-round, prefer
    fit = "conditional" rather than "poor".

19. Keep fertilizer advice general. Do not prescribe a specific fertilizer
    formulation, exact dose, or dilution unless that information is supplied
    separately by the user.

20. Avoid unnecessary numerical precision for watering, fertilizing,
    repotting, or temperature thresholds. Prefer practical signals and
    approximate ranges when exact values vary by conditions.

21. Do not recommend repotting merely because a plant is leggy.
    Repotting guidance should focus on root-space, substrate, drainage,
    or pot-related evidence.

          `.trim(),
        },

        {
          role: "user",
          content: `
Create a general PlantLens care profile for:

Confirmed species:
${input.confirmedSpecies}

Growing context:
City: ${input.locationCity ?? "unknown"}
Country: ${input.locationCountry ?? "unknown"}
Placement: ${input.placement ?? "unknown"}
Light exposure: ${input.lightExposure ?? "unknown"}

Assess both the general species requirements and how well this growing
context fits those requirements.
          `.trim(),
        },
      ],

      response_format: {
        type: "json_schema",

        json_schema: {
          name: "plant_care_profile",
          strict: true,
          schema: z.toJSONSchema(
            plantCareProfileSchema
          ),
        },
      },

      /*
       * Care profiles contain more information than one
       * plant-photo analysis.
       */
      max_completion_tokens: 4000,
    });

  const rawResponse =
    completion.choices[0]?.message?.content;

  if (!rawResponse) {
    throw new Error(
      "Groq returned no plant care profile."
    );
  }

  const parsedResponse =
    JSON.parse(rawResponse);

  return plantCareProfileSchema.parse(
    parsedResponse
  );
}