import { NextResponse, type NextRequest } from "next/server";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import { syncUserInventory } from "@/lib/inventory/sync";
import { inventoryMutationErrorResponse } from "@/lib/inventory/mutation-error-response";

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
    return inventoryMutationErrorResponse(err, "Inventory sync failed");
  }
}
