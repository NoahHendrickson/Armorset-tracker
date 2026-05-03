import { NextResponse, type NextRequest } from "next/server";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
} from "@/lib/auth/bungie-reauth";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  syncUserInventory,
  InventoryNotReady,
} from "@/lib/inventory/sync";
import { BungieApiError } from "@/lib/bungie/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await syncUserInventory(session, { force });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof InventoryNotReady) {
      if (err.status === 401) {
        return NextResponse.json(
          {
            error: err.message,
            code: BUNGIE_REAUTH_REQUIRED_CODE,
            reconnectPath: BUNGIE_RECONNECT_PATH,
          },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: err.message, retryable: err.status === 503 },
        { status: err.status },
      );
    }
    if (err instanceof BungieApiError) {
      return NextResponse.json(
        {
          error: err.message,
          maintenance: err.maintenance,
          retryable: err.maintenance,
        },
        { status: err.status === 503 ? 503 : 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Inventory sync failed" },
      { status: 500 },
    );
  }
}
