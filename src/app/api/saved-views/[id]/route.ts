import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  deleteSavedView,
  renameSavedView,
} from "@/lib/saved-views/queries";

const updateSchema = z.object({
  name: z.string().min(1).max(80),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const view = await renameSavedView(session.userId, id, parsed.data.name);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ view });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const deleted = await deleteSavedView(session.userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
