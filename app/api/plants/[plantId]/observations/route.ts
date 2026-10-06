import { z } from "zod";

import {
  plantAnalysisSchema,
} from "@/lib/plant-analysis-schema";

import {
  PLANT_ANALYSIS_MODEL,
  PLANT_ANALYSIS_VERSION,
} from "@/lib/plant-analysis-config";

import {
  compareObservations,
} from "@/lib/compare-observations";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  compareObservationsSemantically,
} from "@/lib/compare-observations-ai";

export const runtime = "nodejs";

const speciesReviewSchema = z.object({
  decision: z.enum([
    "unreviewed",
    "confirmed",
    "corrected",
  ]),

  confirmedSpecies: z.string().nullable(),
});

type RouteContext = {
  params: Promise<{
    plantId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { plantId } = await context.params;

  const supabase = createSupabaseServerClient();

  let uploadedPhotoPath: string | null = null;

  try {
    // -------------------------------------------------------
    // 1. MAKE SURE THE PLANT EXISTS
    // -------------------------------------------------------

    const { data: plant, error: plantError } =
      await supabase
        .from("plants")
        .select(
          `
            id,
            nickname,
            confirmed_species
          `
        )
        .eq("id", plantId)
        .single();

    if (plantError || !plant) {
      return Response.json(
        {
          success: false,
          error: "Plant not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -------------------------------------------------------
    // 2. READ THE NEW OBSERVATION DATA
    // -------------------------------------------------------

    const formData = await request.formData();

    const image = formData.get("image");
    const analysisValue = formData.get("analysis");
    const speciesReviewValue =
      formData.get("speciesReview");

    if (!(image instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "No plant image was provided.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof analysisValue !== "string" ||
      typeof speciesReviewValue !== "string"
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Analysis or species review is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const analysis = plantAnalysisSchema.parse(
      JSON.parse(analysisValue)
    );

    const speciesReview = speciesReviewSchema.parse(
      JSON.parse(speciesReviewValue)
    );

    // -------------------------------------------------------
    // 3. RETRIEVE ONLY THE MOST RECENT OBSERVATION
    // -------------------------------------------------------

    const {
      data: previousObservation,
      error: previousObservationError,
    } = await supabase
      .from("observations")
      .select(
        `
          id,
          created_at,
          status,
          ai_analysis
        `
      )
      .eq("plant_id", plantId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (previousObservationError) {
      throw previousObservationError;
    }

    /*
     * This is the key longitudinal design choice.
     *
     * We retrieve ONE previous structured observation,
     * not every old photo and not the entire history.
     */

    let comparison = null;

    if (previousObservation) {
      /*
      * Validate the historical AI artifact before using it.
      *
      * We should not assume old database JSON is valid simply
      * because it came from our own database.
      */
      const previousAnalysis =
        plantAnalysisSchema.parse(
          previousObservation.ai_analysis
        );

      // -------------------------------------------------------
      // DETERMINISTIC COMPARISON
      // -------------------------------------------------------

      const deterministicComparison =
        compareObservations(
          previousAnalysis,
          analysis
        );

      // -------------------------------------------------------
      // SEMANTIC AI COMPARISON
      // -------------------------------------------------------

      let semanticComparison = null;

      let semanticComparisonFailed = false;

      try {
        semanticComparison =
          await compareObservationsSemantically(
            previousAnalysis,
            analysis
          );
      } catch (error) {
        /*
        * Important reliability decision:
        *
        * Failure of the optional AI comparison should NOT stop
        * us from saving the user's new observation.
        */
        console.error(
          "Semantic comparison failed:",
          error
        );

        semanticComparisonFailed = true;
      }

      comparison = {
        deterministic:
          deterministicComparison,

        semantic:
          semanticComparison,

        semanticComparisonFailed,
      };
        }

    // -------------------------------------------------------
    // 4. CREATE THE PHOTO PATH
    // -------------------------------------------------------

    const observationId = crypto.randomUUID();

    const originalExtension =
      image.name.split(".").pop()?.toLowerCase() ??
      "jpg";

    const safeExtension =
      originalExtension.replace(
        /[^a-z0-9]/g,
        ""
      ) || "jpg";

    uploadedPhotoPath =
      `${plantId}/${observationId}.${safeExtension}`;

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    // -------------------------------------------------------
    // 5. STORE THE PHOTO
    // -------------------------------------------------------

    const { error: uploadError } =
      await supabase.storage
        .from("plant-photos")
        .upload(
          uploadedPhotoPath,
          imageBuffer,
          {
            contentType: image.type,
            upsert: false,
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    // -------------------------------------------------------
    // 6. HUMAN SPECIES VALUE
    // -------------------------------------------------------

    const humanConfirmedSpecies =
      speciesReview.decision === "unreviewed"
        ? null
        : speciesReview.confirmedSpecies?.trim() ??
          null;

    // -------------------------------------------------------
    // 7. SAVE THE NEW OBSERVATION
    // -------------------------------------------------------

    const {
      data: observation,
      error: observationError,
    } = await supabase
      .from("observations")
      .insert({
        id: observationId,

        plant_id: plantId,

        photo_storage_path:
          uploadedPhotoPath,

        model: PLANT_ANALYSIS_MODEL,

        analysis_version:
          PLANT_ANALYSIS_VERSION,

        ai_analysis: analysis,

        ai_likely_species:
          analysis.likely_species,

        ai_identification_certainty:
          analysis.identification_certainty,

        status: analysis.status,

        needs_review:
          analysis.needs_review,

        human_species_review_decision:
          speciesReview.decision,

        human_confirmed_species:
          humanConfirmedSpecies,

        previous_observation_id:
          previousObservation?.id ?? null,

        comparison,

        comparison_version:
          previousObservation
            ? "deterministic-v1+semantic-v1"
            : null,
      })
      .select(
        `
          id,
          plant_id,
          status,
          previous_observation_id,
          comparison,
          created_at
        `
      )
      .single();

    if (observationError) {
      await supabase.storage
        .from("plant-photos")
        .remove([uploadedPhotoPath]);

      uploadedPhotoPath = null;

      throw observationError;
    }

    // -------------------------------------------------------
    // 8. UPDATE CANONICAL SPECIES IF THE HUMAN REVIEWED IT
    // -------------------------------------------------------

    if (humanConfirmedSpecies) {
      const { error: updatePlantError } =
        await supabase
          .from("plants")
          .update({
            confirmed_species:
              humanConfirmedSpecies,
          })
          .eq("id", plantId);

      if (updatePlantError) {
        console.error(
          "Observation saved, but plant species update failed:",
          updatePlantError
        );
      }
    }

    return Response.json({
      success: true,

      plant,

      observation,

      previousObservation:
        previousObservation
          ? {
              id: previousObservation.id,
              created_at:
                previousObservation.created_at,
              status:
                previousObservation.status,
            }
          : null,

      comparison,
    });
  } catch (error) {
    console.error(
      "Failed to save observation:",
      error
    );

    if (uploadedPhotoPath) {
      await supabase.storage
        .from("plant-photos")
        .remove([uploadedPhotoPath]);
    }

    return Response.json(
      {
        success: false,
        error:
          "Could not save the observation.",
      },
      {
        status: 500,
      }
    );
  }
}