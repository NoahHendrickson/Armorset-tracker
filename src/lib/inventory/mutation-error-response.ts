import "server-only";
import { NextResponse } from "next/server";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
} from "@/lib/auth/bungie-reauth";
import { BungieApiError } from "@/lib/bungie/client";
import { ItemActionError } from "@/lib/inventory/item-actions";
import { InventoryNotReady } from "@/lib/inventory/sync";

export function inventoryMutationErrorResponse(
  err: unknown,
  fallbackMessage = "Request failed",
): NextResponse {
  if (err instanceof ItemActionError) {
    if (err.code === "insufficient_scope") {
      return NextResponse.json(
        {
          error: err.message,
          code: BUNGIE_REAUTH_REQUIRED_CODE,
          reconnectPath: BUNGIE_RECONNECT_PATH,
        },
        { status: 403 },
      );
    }
    if (err.code === "partial_failure" && err.meta) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          partial: true,
          stepsCompleted: err.meta.stepsCompleted,
          stepsTotal: err.meta.stepsTotal,
          syncedAt: err.meta.syncedAt,
          itemCount: err.meta.itemCount,
        },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
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
    { error: err instanceof Error ? err.message : fallbackMessage },
    { status: 500 },
  );
}
