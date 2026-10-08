import {
    plantAnalysisSchema,
  } from "@/lib/plant-analysis-schema";

  import {
    plantCareProfileSchema,
  } from "@/lib/plant-care-profile-schema";
  
  import {
    createSupabaseServerClient,
  } from "@/lib/supabase/server";

  const PLANT_STATUSES = [
    "healthy",
    "watch",
    "needs_attention",
    "uncertain",
  ] as const;

  type PlantStatus = (typeof PLANT_STATUSES)[number];

  function isPlantStatus(
    value: string
  ): value is PlantStatus {
    return (
      PLANT_STATUSES as readonly string[]
    ).includes(value);
  }

  /*
   * History shows one sentence per check-in.
   * Prefer the stored analysis summary, then fall back
   * to the status label if that summary is missing.
   */
  function firstSentence(text: string) {
    const sentence =
      text.split(/(?<=[.!?])\s+/)[0]?.trim() ??
      text.trim();

    return sentence;
  }

  function statusSentence(status: PlantStatus) {
    switch (status) {
      case "healthy":
        return "This check-in looked healthy.";
      case "watch":
        return "This check-in suggested keeping an eye on the plant.";
      case "needs_attention":
        return "This check-in suggested the plant needs attention.";
      case "uncertain":
        return "This check-in did not give a clear status.";
    }
  }

  function checkInSummary(
    aiAnalysis: unknown,
    status: PlantStatus
  ) {
    const parsed =
      plantAnalysisSchema.safeParse(aiAnalysis);

    if (parsed.success) {
      const sentence = firstSentence(
        parsed.data.summary
      );

      if (sentence) {
        return sentence;
      }
    }

    return statusSentence(status);
  }
  
  type RouteContext = {
    params: Promise<{
      plantId: string;
    }>;
  };
  
  export async function GET(
    _request: Request,
    context: RouteContext
  ) {
    const { plantId } = await context.params;
  
    try {
      const supabase =
        createSupabaseServerClient();
  
      // -------------------------------------------------------
      // 1. LOAD THE PLANT
      // -------------------------------------------------------
  
      const {
        data: plant,
        error: plantError,
      } = await supabase
        .from("plants")
        .select(
          `
            id,
            nickname,
            confirmed_species,
            location_city,
            location_country,
            placement,
            light_exposure,
            created_at,
            care_profile,
            care_profile_species,
            care_profile_model,
            care_profile_version,
            care_profile_generated_at
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
      // 2. LOAD CHECK-IN HISTORY
      //
      // Newest first. The first row is also the latest status.
      // -------------------------------------------------------
  
      const {
        data: observations,
        error: observationError,
      } = await supabase
        .from("observations")
        .select(
          `
            id,
            status,
            created_at,
            ai_analysis
          `
        )
        .eq("plant_id", plantId)
        .order("created_at", {
          ascending: false,
        });
  
      if (observationError) {
        throw observationError;
      }

      const history = (observations ?? []).flatMap(
        (observation) => {
          if (!isPlantStatus(observation.status)) {
            return [];
          }

          return [
            {
              id: observation.id,
              created_at: observation.created_at,
              status: observation.status,
              summary: checkInSummary(
                observation.ai_analysis,
                observation.status
              ),
            },
          ];
        }
      );

      const latestObservation = history[0] ?? null;
  
      // -------------------------------------------------------
      // 3. VALIDATE THE STORED CARE PROFILE
      // -------------------------------------------------------
  
      let validatedCareProfile = null;
      let careProfileInvalid = false;
  
      if (plant.care_profile) {
        /*
         * Historical JSON should still be validated before
         * the application relies on it.
         */
        const result =
          plantCareProfileSchema.safeParse(
            plant.care_profile
          );
  
        if (result.success) {
          validatedCareProfile =
            result.data;
        } else {
          /*
           * Don't break the entire Plant page because one
           * stored AI artifact has become invalid.
           */
          careProfileInvalid = true;
  
          console.error(
            "Stored care profile failed validation:",
            result.error
          );
        }
      }
  
      // -------------------------------------------------------
      // 4. DETECT A STALE CARE PROFILE
      // -------------------------------------------------------
  
      /*
       * Example:
       *
       * confirmed_species = "Philodendron"
       * care_profile_species = "Monstera"
       *
       * In that case the old guide should no longer be trusted.
       */
      const careProfileStale =
        Boolean(
          plant.care_profile &&
            plant.confirmed_species &&
            plant.care_profile_species &&
            plant.confirmed_species !==
              plant.care_profile_species
        );
  
      // -------------------------------------------------------
      // 5. RETURN THE PROFILE
      // -------------------------------------------------------
  
      return Response.json({
        success: true,
  
        plant: {
          ...plant,
  
          care_profile:
            validatedCareProfile,
  
          care_profile_invalid:
            careProfileInvalid,
  
          care_profile_stale:
            careProfileStale,
  
          latest_status:
            latestObservation?.status ??
            null,
  
          last_checked_at:
            latestObservation?.created_at ??
            null,
  
          latest_observation_id:
            latestObservation?.id ??
            null,

          history,
        },
      });
    } catch (error) {
      console.error(
        "Failed to load Plant profile:",
        error
      );
  
      return Response.json(
        {
          success: false,
          error:
            "Could not load the plant profile.",
        },
        {
          status: 500,
        }
      );
    }
  }