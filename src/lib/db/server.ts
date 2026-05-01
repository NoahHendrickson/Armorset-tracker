import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

export function getServiceRoleClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const env = serverEnv();
  cached = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return cached;
}
