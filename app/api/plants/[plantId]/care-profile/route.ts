import {
    generatePlantCareProfile,
  } from "@/lib/generate-plant-care-profile";
  
  import {
    PLANT_ANALYSIS_MODEL,
    PLANT_CARE_PROFILE_VERSION,
  } from "@/lib/plant-analysis-config";
  
  import {
    createSupabaseServerClient,
  } from "@/lib/supabase/server";
  
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
  
    const supabase =
      createSupabaseServerClient();
  
    try {
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
            light_exposure
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
      // 2. REQUIRE HUMAN-CONFIRMED SPECIES
      // -------------------------------------------------------
  
      if (!plant.confirmed_species) {
        return Response.json(
          {
            success: false,
            error:
              "Confirm the plant species before generating its care profile.",
          },
          {
            status: 400,
          }
        );
      }
  
      // -------------------------------------------------------
      // 3. GENERATE THE STRUCTURED CARE PROFILE
      // -------------------------------------------------------
  
      const careProfile =
        await generatePlantCareProfile({
          confirmedSpecies:
            plant.confirmed_species,
  
          locationCity:
            plant.location_city,
  
          locationCountry:
            plant.location_country,
  
          placement:
            plant.placement,
  
          lightExposure:
            plant.light_exposure,
        });
  
      // -------------------------------------------------------
      // 4. SAVE IT TO THE PLANT
      // -------------------------------------------------------
  
      const {
        data: updatedPlant,
        error: updateError,
      } = await supabase
        .from("plants")
        .update({
          care_profile: careProfile,
  
          /*
           * Preserve provenance so later we know what species,
           * model, and care-system version generated this data.
           */
          care_profile_species:
            plant.confirmed_species,
  
          care_profile_model:
            PLANT_ANALYSIS_MODEL,
  
          care_profile_version:
            PLANT_CARE_PROFILE_VERSION,
  
          care_profile_generated_at:
            new Date().toISOString(),
        })
        .eq("id", plantId)
        .select(
          `
            id,
            nickname,
            confirmed_species,
            location_city,
            location_country,
            placement,
            light_exposure,
            care_profile,
            care_profile_species,
            care_profile_model,
            care_profile_version,
            care_profile_generated_at
          `
        )
        .single();
  
      if (updateError) {
        throw updateError;
      }
  
      return Response.json({
        success: true,
        plant: updatedPlant,
      });
    } catch (error) {
      console.error(
        "Failed to generate plant care profile:",
        error
      );
  
      return Response.json(
        {
          success: false,
          error:
            "Could not generate the plant care profile.",
        },
        {
          status: 500,
        }
      );
    }
  }