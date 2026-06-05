import { NextResponse, type NextRequest } from "next/server";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  clearDropFeed,
  dismissDropFeedEntry,
  listDropFeed,
} from "@/lib/inventory/drop-feed";

export async function GET(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const feed = await listDropFeed(session.userId);
    return NextResponse.json({ ok: true, feed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drop feed load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const itemInstanceId = new URL(req.url).searchParams.get("itemInstanceId");

  try {
    if (itemInstanceId) {
      await dismissDropFeedEntry(session.userId, itemInstanceId);
    } else {
      await clearDropFeed(session.userId);
    }
    const feed = await listDropFeed(session.userId);
    return NextResponse.json({ ok: true, feed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drop feed update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
