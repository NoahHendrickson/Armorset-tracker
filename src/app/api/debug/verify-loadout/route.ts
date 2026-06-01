import { NextResponse, type NextRequest } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { totalsFromPieces } from "@/lib/optimizer/constraints";
import { totalAssumedModBudget } from "@/lib/optimizer/mod-offset";
import { countPiecesBySetHash } from "@/lib/optimizer/set-bonus";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";
import { getCachedInventory } from "@/lib/inventory/sync";

/** DIM / loadout instance ids (Bungie itemInstanceId strings). */
function parseIdsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.replace(/^id:/i, "").replace(/['"]/g, "").trim())
    .filter(Boolean);
}

function parseMin(
  url: URL,
  stat: ArmorStatName,
): number {
  const v = url.searchParams.get(`${stat}Min`);
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSessionFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ids = parseIdsParam(url.searchParams.get("ids"));
  if (ids.length === 0) {
    return NextResponse.json(
      {
        error:
          "Missing ids query param. Example: ?ids=6917530125283917710,6917530167771126356,...",
      },
      { status: 400 },
    );
  }

  const inventory = (await getCachedInventory(session.userId)) ?? [];
  const byId = new Map(inventory.map((p) => [p.itemInstanceId, p]));
  const missing = ids.filter((id) => !byId.has(id));
  const pieces = ids
    .map((id) => byId.get(id))
    .filter((p): p is DerivedArmorPieceJson => p != null);

  const constraints = ARMOR_STAT_NAMES.map((stat) => ({
    stat,
    min: parseMin(url, stat),
  })).filter((row) => row.min > 0);

  const majorCount = Math.min(
    5,
    Math.max(0, Number(url.searchParams.get("majorCount") ?? "3") || 0),
  );
  const assumedMods = {
    majorCount,
    slotFill: url.searchParams.get("slotFill") !== "false",
    artifice: url.searchParams.get("artifice") !== "false",
  };

  const armorTotals = pieces.length > 0 ? totalsFromPieces(pieces) : null;
  const budget = totalAssumedModBudget(assumedMods);
  const setCounts = Object.fromEntries(
    countPiecesBySetHash(pieces).entries(),
  );

  const verify =
    pieces.length === 5 && missing.length === 0
      ? verifyLoadout(pieces, { constraints, assumedMods })
      : null;

  return NextResponse.json({
    requestedIds: ids,
    found: pieces.length,
    missingIds: missing,
    pieces: pieces.map((p) => ({
      itemInstanceId: p.itemInstanceId,
      slot: p.slot,
      displayName: p.displayName ?? p.setName,
      isExotic: p.isExotic === true,
      setHash: p.setHash,
      setName: p.setName,
      tier: p.tier ?? null,
      tuningCommitted: p.tuningCommitted ?? null,
      tuningName: p.tuningName,
      statTotals: p.statTotals ?? null,
      hasStatTotals:
        p.statTotals != null && Object.keys(p.statTotals).length > 0,
      tuningVariantCount: p.tuningVariants?.length ?? 0,
    })),
    armorTotals,
    assumedModBudget: budget,
    setPieceCounts: setCounts,
    constraints,
    verify: verify?.ok
      ? { ok: true, totals: verify.resolved.totals, modAllocation: verify.resolved.modAllocation }
      : verify
        ? { ok: false, reason: verify.reason }
        : {
            ok: false,
            reason:
              missing.length > 0
                ? `Missing ${missing.length} id(s) from inventory cache — refresh inventory, then retry.`
                : `Need exactly 5 ids (got ${pieces.length}).`,
          },
  });
}
