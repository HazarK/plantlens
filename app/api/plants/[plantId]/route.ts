import {
    plantCareProfileSchema,
  } from "@/lib/plant-care-profile-schema";
  
  import {
    createSupabaseServerClient,
  } from "@/lib/supabase/server";
  
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
      // 2. LOAD ONLY THE LATEST OBSERVATION
      // -------------------------------------------------------
  
      const {
        data: latestObservation,
        error: observationError,
      } = await supabase
        .from("observations")
        .select(
          `
            id,
            status,
            created_at
          `
        )
        .eq("plant_id", plantId)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();
  
      if (observationError) {
        throw observationError;
      }
  
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