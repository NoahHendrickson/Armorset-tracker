import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import type { Json, TablesUpdate } from "@/lib/db/types";
import { workspaceCameraSchema } from "@/lib/workspace/workspace-schema";
import { gridFiltersSchema } from "@/lib/workspace/grid-filters-schema";

const patchSchema = z
  .object({
    camera: workspaceCameraSchema.optional(),
    gridFilters: gridFiltersSchema.optional(),
  })
  .refine((d) => d.camera !== undefined || d.gridFilters !== undefined, {
    message: "Must include camera or gridFilters",
  });

export async function PATCH(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const update: TablesUpdate<"users"> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.camera !== undefined) {
    update.workspace_camera = parsed.data.camera as Json;
  }
  if (parsed.data.gridFilters !== undefined) {
    update.grid_filters = parsed.data.gridFilters as Json;
  }

  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("users")
    .update(update)
    .eq("id", session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
