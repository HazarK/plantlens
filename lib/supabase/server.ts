import { createClient } from "@supabase/supabase-js";

/*
 * Creates a Supabase client for SERVER-SIDE code only.
 */
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured.");
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}