import type { NextRequest } from "next/server";
import { handleInventoryItemAction } from "@/lib/inventory/item-action-route";
import { equipArmorForClass } from "@/lib/inventory/item-actions";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleInventoryItemAction(req, equipArmorForClass);
}
