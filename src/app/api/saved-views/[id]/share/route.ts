import { NextResponse, type NextRequest } from "next/server";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import {
  ensureShareSlug,
  revokeShareSlug,
} from "@/lib/saved-views/queries";
import { buildSavedFilterViewShareUrl } from "@/lib/saved-views/schema";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const view = await ensureShareSlug(session.userId, id);
  if (!view?.share_slug) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = clientEnv().NEXT_PUBLIC_APP_URL;
  const url = buildSavedFilterViewShareUrl(origin, view.share_slug);
  return NextResponse.json({ slug: view.share_slug, url });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const view = await revokeShareSlug(session.userId, id);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ view });
}
