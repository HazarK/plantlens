import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    /*
     * Create our server-side connection to Supabase.
     */
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("connection_checks")
      .insert({
        message: "PlantLens successfully connected to Supabase",
      })
      .select("id, message, created_at")
      .single();

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      message: "Supabase connection works.",
      databaseRow: data,
    });
  } catch (error) {
    console.error("Supabase connection test failed:", error);

    return Response.json(
      {
        success: false,
        error: "Could not connect to Supabase.",
      },
      {
        status: 500,
      }
    );
  }
}