import type { NextRequest } from "next/server";
import { handleInventoryItemAction } from "@/lib/inventory/item-action-route";
import { moveArmorToClass } from "@/lib/inventory/item-actions";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleInventoryItemAction(req, moveArmorToClass);
}
