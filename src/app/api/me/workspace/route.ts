import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import type { Json } from "@/lib/db/types";
import { workspaceCameraSchema } from "@/lib/workspace/workspace-schema";

const patchSchema = z.object({
  camera: workspaceCameraSchema,
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
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

  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("users")
    .update({
      workspace_camera: parsed.data.camera as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
