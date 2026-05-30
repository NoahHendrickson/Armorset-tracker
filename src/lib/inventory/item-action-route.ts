import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  type ArmorItemActionInput,
  type ArmorItemActionResult,
} from "@/lib/inventory/item-actions";
import { inventoryMutationErrorResponse } from "@/lib/inventory/mutation-error-response";
import { GRID_FILTER_CLASS_VALUES } from "@/lib/workspace/grid-filters-schema";
import type { Session } from "@/lib/auth/session";

const bodySchema = z.object({
  itemInstanceId: z.string().min(1),
  itemHash: z.number().int().nonnegative(),
  classType: z.union([
    z.literal(GRID_FILTER_CLASS_VALUES[0]),
    z.literal(GRID_FILTER_CLASS_VALUES[1]),
    z.literal(GRID_FILTER_CLASS_VALUES[2]),
  ]),
});

export async function handleInventoryItemAction(
  req: NextRequest,
  handler: (
    session: Session,
    input: ArmorItemActionInput,
  ) => Promise<ArmorItemActionResult>,
) {
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await handler(session, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return inventoryMutationErrorResponse(err);
  }
}
