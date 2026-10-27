import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Client Supabase khusus server (memakai service role key).
 * Jangan diimpor dari komponen klien; key ini tidak boleh sampai ke browser.
 */
export function getSupabaseServer(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Env SUPABASE_URL belum diisi.");
  }
  if (!serviceRoleKey) {
    throw new Error("Env SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
