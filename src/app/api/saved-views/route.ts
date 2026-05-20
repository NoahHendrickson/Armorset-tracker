import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  createSavedView,
  listSavedViewsForUser,
} from "@/lib/saved-views/queries";
import { savedFilterViewPayloadSchema } from "@/lib/saved-views/schema";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  filters: savedFilterViewPayloadSchema,
});

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const views = await listSavedViewsForUser(session.userId);
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
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const view = await createSavedView(session.userId, {
    name: parsed.data.name,
    filters: parsed.data.filters,
  });

  return NextResponse.json({ view }, { status: 201 });
}
