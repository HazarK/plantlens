import { z } from "zod";

import { plantAnalysisSchema } from "@/lib/plant-analysis-schema";
import {
  PLANT_ANALYSIS_MODEL,
  PLANT_ANALYSIS_VERSION,
} from "@/lib/plant-analysis-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
 * Human review has its own schema because it is separate
 * from the AI-generated PlantAnalysis.
 */
const speciesReviewSchema = z
  .object({
    decision: z.enum([
      "unreviewed",
      "confirmed",
      "corrected",
    ]),

    confirmedSpecies: z.string().nullable(),
  })
  .superRefine((review, context) => {
    /*
     * If the user has not reviewed the prediction,
     * there should not be a human-confirmed species yet.
     */
    if (
      review.decision === "unreviewed" &&
      review.confirmedSpecies !== null
    ) {
      context.addIssue({
        code: "custom",
        message:
          "An unreviewed species cannot have a confirmed value.",
      });
    }

    /*
     * If the user confirmed or corrected the prediction,
     * we require an actual species value.
     */
    if (
      review.decision !== "unreviewed" &&
      !review.confirmedSpecies?.trim()
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A reviewed species must contain a confirmed value.",
      });
    }
  });

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  /*
   * We'll keep track of resources we create so that we can
   * clean them up if a later step fails.
   */
  let createdPlantId: string | null = null;
  let uploadedPhotoPath: string | null = null;

  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const nicknameValue = formData.get("nickname");
    const analysisValue = formData.get("analysis");
    const speciesReviewValue = formData.get("speciesReview");

    /*
     * Validate the uploaded image.
     */
    if (!(image instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "No plant image was provided.",
        },
        { status: 400 }
      );
    }

    if (!image.type.startsWith("image/")) {
      return Response.json(
        {
          success: false,
          error: "The uploaded file must be an image.",
        },
        { status: 400 }
      );
    }

    const maxFileSize = 20 * 1024 * 1024;

    if (image.size > maxFileSize) {
      return Response.json(
        {
          success: false,
          error: "The image must be smaller than 20 MB.",
        },
        { status: 400 }
      );
    }

    /*
     * FormData values arrive as strings, Files, or null.
     */
    if (typeof nicknameValue !== "string") {
      return Response.json(
        {
          success: false,
          error: "Plant nickname is required.",
        },
        { status: 400 }
      );
    }

    const nickname = nicknameValue.trim();

    if (!nickname) {
      return Response.json(
        {
          success: false,
          error: "Plant nickname cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (nickname.length > 100) {
      return Response.json(
        {
          success: false,
          error: "Plant nickname is too long.",
        },
        { status: 400 }
      );
    }

    if (
      typeof analysisValue !== "string" ||
      typeof speciesReviewValue !== "string"
    ) {
      return Response.json(
        {
          success: false,
          error: "Analysis or species review is missing.",
        },
        { status: 400 }
      );
    }

    /*
     * The browser sends the AI analysis back as JSON.
     *
     * We DO NOT blindly trust it. We validate it against the
     * exact same Zod schema used for our AI contract.
     */
    const analysis = plantAnalysisSchema.parse(
      JSON.parse(analysisValue)
    );

    const speciesReview = speciesReviewSchema.parse(
      JSON.parse(speciesReviewValue)
    );

    /*
     * Only a human-reviewed species becomes the plant's
     * canonical confirmed_species.
     *
     * We deliberately do NOT copy the AI prediction here.
     */
    const confirmedSpecies =
      speciesReview.decision === "unreviewed"
        ? null
        : speciesReview.confirmedSpecies?.trim() ?? null;

    // ---------------------------------------------------------
    // 1. CREATE THE PLANT PROFILE
    // ---------------------------------------------------------

    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .insert({
        nickname,
        confirmed_species: confirmedSpecies,
      })
      .select("id, nickname, confirmed_species, created_at")
      .single();

    if (plantError) {
      throw plantError;
    }

    createdPlantId = plant.id;

    // ---------------------------------------------------------
    // 2. CREATE A UNIQUE PHOTO PATH
    // ---------------------------------------------------------

    /*
     * Generate the observation ID ourselves.
     *
     * Postgres would normally generate it, but creating it here
     * lets us use the same ID inside the Storage path.
     */
    const observationId = crypto.randomUUID();

    /*
     * Keep only safe characters from the original extension.
     */
    const originalExtension =
      image.name.split(".").pop()?.toLowerCase() ?? "jpg";

    const safeExtension =
      originalExtension.replace(/[^a-z0-9]/g, "") || "jpg";

    uploadedPhotoPath =
      `${plant.id}/${observationId}.${safeExtension}`;

    // ---------------------------------------------------------
    // 3. UPLOAD THE PHOTO TO SUPABASE STORAGE
    // ---------------------------------------------------------

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    const { error: uploadError } = await supabase.storage
      .from("plant-photos")
      .upload(uploadedPhotoPath, imageBuffer, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      /*
       * We created a Plant but failed to save its photograph.
       * Remove the empty Plant before reporting the failure.
       */
      await supabase
        .from("plants")
        .delete()
        .eq("id", plant.id);

      createdPlantId = null;

      throw uploadError;
    }

    // ---------------------------------------------------------
    // 4. CREATE THE FIRST OBSERVATION
    // ---------------------------------------------------------

    const { data: observation, error: observationError } =
      await supabase
        .from("observations")
        .insert({
          id: observationId,

          plant_id: plant.id,

          photo_storage_path: uploadedPhotoPath,

          model: PLANT_ANALYSIS_MODEL,

          analysis_version: PLANT_ANALYSIS_VERSION,

          /*
           * Store the complete AI artifact.
           */
          ai_analysis: analysis,

          /*
           * Also store important searchable fields separately.
           */
          ai_likely_species: analysis.likely_species,

          ai_identification_certainty:
            analysis.identification_certainty,

          status: analysis.status,

          needs_review: analysis.needs_review,

          /*
           * Preserve human review separately from AI prediction.
           */
          human_species_review_decision:
            speciesReview.decision,

          human_confirmed_species: confirmedSpecies,
        })
        .select(
          `
            id,
            plant_id,
            photo_storage_path,
            model,
            analysis_version,
            status,
            created_at
          `
        )
        .single();

    if (observationError) {
      /*
       * Storage succeeded but the database write failed.
       *
       * Remove the orphaned image and Plant so we don't leave
       * half-saved product state behind.
       */
      await supabase.storage
        .from("plant-photos")
        .remove([uploadedPhotoPath]);

      uploadedPhotoPath = null;

      await supabase
        .from("plants")
        .delete()
        .eq("id", plant.id);

      createdPlantId = null;

      throw observationError;
    }

    return Response.json({
      success: true,

      plant,

      observation,
    });
  } catch (error) {
    console.error("Failed to save PlantLens plant:", error);

    /*
     * Defensive cleanup if an unexpected error happened after
     * one of our resources had already been created.
     */
    if (uploadedPhotoPath) {
      await supabase.storage
        .from("plant-photos")
        .remove([uploadedPhotoPath]);
    }

    if (createdPlantId) {
      await supabase
        .from("plants")
        .delete()
        .eq("id", createdPlantId);
    }

    return Response.json(
      {
        success: false,
        error: "Could not save the plant.",
      },
      {
        status: 500,
      }
    );
  }
}