import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import type { ViewRow } from "@/lib/db/types";
import { getServiceRoleClient } from "@/lib/db/server";
import { getCachedInventoryWithSyncedAt } from "@/lib/inventory/sync";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { listViewsForUser } from "@/lib/views/queries";
import { buildSerializableTrackerPayload } from "@/lib/workspace/build-tracker-payload";
import { workspaceLayoutSchema } from "@/lib/workspace/workspace-schema";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  set_hash: z.coerce.number().int(),
  archetype_hash: z.coerce.number().int(),
  tuning_hash: z.coerce.number().int(),
  // Bungie's classType convention: 0 Titan, 1 Hunter, 2 Warlock.
  class_type: z.coerce.number().int().min(0).max(2),
  layout: workspaceLayoutSchema.optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const views = await listViewsForUser(session.userId);
  return NextResponse.json({ views });
}

export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const sb = getServiceRoleClient();
  const lookupsPromise = getManifestLookups();
  const cachedPromise = getCachedInventoryWithSyncedAt(session.userId);
  const { layout: layoutPayload, ...createFields } = parsed.data;
  const trimmedName = createFields.name.trim();

  const { data: duplicateRow } = await sb
    .from("views")
    .select("id")
    .eq("user_id", session.userId)
    .eq("name", trimmedName)
    .eq("set_hash", createFields.set_hash)
    .eq("archetype_hash", createFields.archetype_hash)
    .eq("tuning_hash", createFields.tuning_hash)
    .eq("class_type", createFields.class_type)
    .maybeSingle();

  if (duplicateRow) {
    return NextResponse.json(
      {
        error:
          "A tracker with this name and build already exists. Change something and try again.",
      },
      { status: 409 },
    );
  }

  const { data, error } = await sb
    .from("views")
    .insert({
      user_id: session.userId,
      name: trimmedName,
      set_hash: createFields.set_hash,
      archetype_hash: createFields.archetype_hash,
      tuning_hash: createFields.tuning_hash,
      class_type: createFields.class_type,
      ...(layoutPayload !== undefined
        ? { layout: layoutPayload }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Insert failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const viewRow = data as ViewRow;
  const [lookups, cached] = await Promise.all([lookupsPromise, cachedPromise]);
  const inventory = cached?.items ?? [];
  const tracker = buildSerializableTrackerPayload(viewRow, lookups, inventory);

  return NextResponse.json({ view: data, tracker }, { status: 201 });
}
