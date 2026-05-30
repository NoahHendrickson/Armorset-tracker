import "server-only";
import {
  BungieApiError,
  equipDestinyItem,
  getProfile,
  transferDestinyItem,
} from "@/lib/bungie/client";
import { withBackoff, withUserRateLimit } from "@/lib/bungie/rate-limit";
import { getValidAccessToken } from "@/lib/auth/tokens";
import { BUNGIE_REAUTH_USER_MESSAGE } from "@/lib/auth/bungie-reauth";
import type { Session } from "@/lib/auth/session";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import {
  EQUIP_ACTION_GAP_MS,
  type EquipPlanStep,
  planEquipSteps,
  planTransferSteps,
  resolveCharacterIdForClass,
  wrongClassForTarget,
} from "@/lib/inventory/equip-plan";
import {
  getCachedInventory,
  syncUserInventory,
  InventoryNotReady,
} from "@/lib/inventory/sync";

const PROFILE_CHARACTERS_COMPONENT = 200;

const INSUFFICIENT_SCOPE_ERROR_CODES = new Set([
  2108,
  1653,
  1900,
  1901,
]);

export type ItemActionErrorCode =
  | "inventory_stale"
  | "insufficient_scope"
  | "partial_failure";

export interface ItemActionErrorMeta {
  syncedAt?: string;
  itemCount?: number;
  stepsCompleted?: number;
  stepsTotal?: number;
}

export class ItemActionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: ItemActionErrorCode | string,
    readonly meta?: ItemActionErrorMeta,
  ) {
    super(message);
    this.name = "ItemActionError";
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function findCachedPiece(
  items: DerivedArmorPieceJson[],
  itemInstanceId: string,
): DerivedArmorPieceJson | null {
  return items.find((p) => p.itemInstanceId === itemInstanceId) ?? null;
}

function mapBungieItemActionError(err: BungieApiError): ItemActionError | InventoryNotReady {
  if (err.errorCode != null && INSUFFICIENT_SCOPE_ERROR_CODES.has(err.errorCode)) {
    return new ItemActionError(
      "Reconnect Bungie and approve move/equip permissions on the consent screen.",
      403,
      "insufficient_scope",
    );
  }
  if (err.maintenance) {
    return new InventoryNotReady("Bungie API is in maintenance.", 503);
  }
  return new ItemActionError(err.message, 502);
}

function partialFailureMessage(completed: number, total: number): string {
  return `Completed ${completed} of ${total} steps before failing. Inventory was refreshed — check your vault and characters.`;
}

export interface ArmorItemActionInput {
  itemInstanceId: string;
  itemHash: number;
  classType: GridFilterClass;
}

export interface ArmorItemActionResult {
  syncedAt: string;
  itemCount: number;
  noop: boolean;
}

async function resolveTargetCharacterId(
  session: Session,
  accessToken: string,
  classType: GridFilterClass,
): Promise<string> {
  const profile = await withUserRateLimit(session.userId, () =>
    withBackoff(
      () =>
        getProfile(
          session.bungieMembershipType,
          session.bungieMembershipId,
          [PROFILE_CHARACTERS_COMPONENT],
          accessToken,
        ),
      { retries: 2, baseMs: 400 },
    ),
  );

  const targetCharacterId = resolveCharacterIdForClass(
    profile.characters?.data ?? {},
    classType,
  );
  if (!targetCharacterId) {
    throw new ItemActionError("No character found for the selected class.", 404);
  }
  return targetCharacterId;
}

async function validatePiece(
  session: Session,
  input: ArmorItemActionInput,
): Promise<DerivedArmorPieceJson> {
  const cached = await getCachedInventory(session.userId);
  if (!cached?.length) {
    throw new ItemActionError(
      "Refresh inventory before moving or equipping armor.",
      409,
      "inventory_stale",
    );
  }

  const piece = findCachedPiece(cached, input.itemInstanceId);
  if (!piece || piece.itemHash !== input.itemHash) {
    throw new ItemActionError("That armor piece was not found in your cache.", 404);
  }

  const classMessage = wrongClassForTarget(piece, input.classType);
  if (classMessage) {
    throw new ItemActionError(classMessage, 400);
  }

  return piece;
}

async function executePlanStep(
  session: Session,
  accessToken: string,
  input: ArmorItemActionInput,
  step: EquipPlanStep,
): Promise<void> {
  if (step.kind === "transfer") {
    await transferDestinyItem(accessToken, {
      membershipType: session.bungieMembershipType,
      itemReferenceHash: input.itemHash,
      itemId: input.itemInstanceId,
      stackSize: 1,
      characterId: step.characterId,
      transferToVault: step.transferToVault,
    });
    return;
  }
  await equipDestinyItem(accessToken, {
    membershipType: session.bungieMembershipType,
    itemId: input.itemInstanceId,
    characterId: step.characterId,
  });
}

async function executeArmorAction(
  session: Session,
  input: ArmorItemActionInput,
  mode: "move" | "equip",
): Promise<ArmorItemActionResult> {
  const piece = await validatePiece(session, input);

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
  }

  const targetCharacterId = await resolveTargetCharacterId(
    session,
    accessToken,
    input.classType,
  );

  const planned =
    mode === "equip"
      ? planEquipSteps(piece, targetCharacterId)
      : planTransferSteps(piece, targetCharacterId);

  if (planned.length === 0) {
    const sync = await syncUserInventory(session, { force: true });
    return {
      syncedAt: sync.syncedAt,
      itemCount: sync.itemCount,
      noop: true,
    };
  }

  let executedSteps = 0;
  let failure: unknown = null;

  try {
    for (let i = 0; i < planned.length; i++) {
      if (i > 0) await sleep(EQUIP_ACTION_GAP_MS);
      try {
        await withUserRateLimit(session.userId, () =>
          withBackoff(
            () => executePlanStep(session, accessToken, input, planned[i]!),
            { retries: 2, baseMs: 400 },
          ),
        );
      } catch (err) {
        if (err instanceof BungieApiError) {
          throw mapBungieItemActionError(err);
        }
        throw err;
      }
      executedSteps++;
    }
  } catch (err) {
    failure = err;
  }

  let syncAfterSteps: { syncedAt: string; itemCount: number } | null = null;
  if (executedSteps > 0) {
    const sync = await syncUserInventory(session, { force: true });
    syncAfterSteps = { syncedAt: sync.syncedAt, itemCount: sync.itemCount };
  }

  if (failure) {
    if (executedSteps > 0 && syncAfterSteps) {
      throw new ItemActionError(
        partialFailureMessage(executedSteps, planned.length),
        502,
        "partial_failure",
        {
          ...syncAfterSteps,
          stepsCompleted: executedSteps,
          stepsTotal: planned.length,
        },
      );
    }
    throw failure;
  }

  return {
    ...syncAfterSteps!,
    noop: false,
  };
}

export async function moveArmorToClass(
  session: Session,
  input: ArmorItemActionInput,
): Promise<ArmorItemActionResult> {
  return executeArmorAction(session, input, "move");
}

export async function equipArmorForClass(
  session: Session,
  input: ArmorItemActionInput,
): Promise<ArmorItemActionResult> {
  return executeArmorAction(session, input, "equip");
}
