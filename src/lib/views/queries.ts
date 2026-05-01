import "server-only";
import { getServiceRoleClient } from "@/lib/db/server";
import type { ViewRow } from "@/lib/db/types";

export async function listViewsForUser(userId: string): Promise<ViewRow[]> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("views")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listViewsForUser failed: ${error.message}`);
  return (data ?? []) as ViewRow[];
}

export async function getViewForUser(
  userId: string,
  viewId: string,
): Promise<ViewRow | null> {
  const sb = getServiceRoleClient();
  const { data } = await sb
    .from("views")
    .select("*")
    .eq("user_id", userId)
    .eq("id", viewId)
    .maybeSingle();
  return (data as ViewRow) ?? null;
}
