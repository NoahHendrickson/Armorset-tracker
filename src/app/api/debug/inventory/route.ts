import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { getCachedInventory } from "@/lib/inventory/sync";
import { getViewForUser } from "@/lib/views/queries";
import { getManifestLookups, resolveViewSetHash } from "@/lib/manifest/lookups";
import type { DerivedArmorPieceJson } from "@/lib/db/types";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const sb = getServiceRoleClient();
  const url = new URL(req.url);
  const viewId = url.searchParams.get("viewId");

  const [
    inventory,
    sets,
    archetypes,
    tunings,
    armorItems,
    plugArch,
    plugTun,
    statPairs,
    statPlugs,
    statIcons,
  ] = await Promise.all([
    getCachedInventory(session.userId),
    sb.from("armor_sets").select("*", { count: "exact", head: true }),
    sb.from("archetypes").select("*", { count: "exact", head: true }),
    sb.from("tunings").select("*", { count: "exact", head: true }),
    sb.from("armor_items").select("*", { count: "exact", head: true }),
    sb.from("plug_to_archetype").select("*", { count: "exact", head: true }),
    sb.from("plug_to_tuning").select("*", { count: "exact", head: true }),
    sb.from("archetype_stat_pairs").select("*", { count: "exact", head: true }),
    sb.from("armor_stat_plugs").select("*", { count: "exact", head: true }),
    sb.from("armor_stat_icons").select("*", { count: "exact", head: true }),
  ]);

  const items = inventory ?? [];
  const counts = aggregateInventory(items);

  const sampleStatPairs = await sb.from("archetype_stat_pairs").select("*").limit(10);
  const sampleStatPlugs = await sb.from("armor_stat_plugs").select("*").limit(20);
  const sampleStatIcons = await sb.from("armor_stat_icons").select("*").limit(20);

  // Inventory cache structure check: were the new fields written or are pieces
  // missing them entirely? If so, the cache pre-dates the schema change.
  const piecesWithTertiaryField = items.filter(
    (p) => "tertiaryStat" in p,
  ).length;
  const piecesWithTertiaryStat = items.filter(
    (p) => p.tertiaryStat !== null && p.tertiaryStat !== undefined,
  ).length;

  const inventorySample = items.slice(0, 5).map((p) => ({
    slot: p.slot,
    itemHash: p.itemHash,
    setName: p.setName,
    archetypeName: p.archetypeName,
    tuningName: p.tuningName,
    primaryStat: p.primaryStat,
    secondaryStat: p.secondaryStat,
    tertiaryStat: p.tertiaryStat,
  }));

  let viewMatch: ViewMatchReport | null = null;
  if (viewId) {
    const view = await getViewForUser(session.userId, viewId);
    if (view) {
      const lookups = await getManifestLookups();
      const resolved = resolveViewSetHash(Number(view.set_hash), lookups);
      viewMatch = matchAgainstView(items, { ...view, set_hash: resolved });
    }
  }

  return NextResponse.json({
    inventory: {
      total: items.length,
      piecesWithTertiaryField,
      piecesWithTertiaryStat,
      ...counts,
      sample: inventorySample,
    },
    manifest: {
      armorSets: sets.count ?? 0,
      armorItems: armorItems.count ?? 0,
      archetypes: archetypes.count ?? 0,
      tunings: tunings.count ?? 0,
      plugToArchetype: plugArch.count ?? 0,
      plugToTuning: plugTun.count ?? 0,
      archetypeStatPairs: statPairs.count ?? 0,
      armorStatPlugs: statPlugs.count ?? 0,
      armorStatIcons: statIcons.count ?? 0,
      sampleStatPairs: sampleStatPairs.data ?? [],
      sampleStatPlugs: sampleStatPlugs.data ?? [],
      sampleStatIcons: sampleStatIcons.data ?? [],
    },
    viewMatch,
  });
}

interface InventoryCounts {
  withSetHash: number;
  withArchetypeHash: number;
  withTuningHash: number;
  withAllThree: number;
  perSlot: Record<string, number>;
  topSets: Array<{ hash: number; name: string | null; count: number }>;
  topArchetypes: Array<{ hash: number; name: string | null; count: number }>;
  topTunings: Array<{ hash: number; name: string | null; count: number }>;
}

function aggregateInventory(items: DerivedArmorPieceJson[]): InventoryCounts {
  let withSetHash = 0;
  let withArchetypeHash = 0;
  let withTuningHash = 0;
  let withAllThree = 0;
  const perSlot: Record<string, number> = {};
  const setCounts = new Map<number, { name: string | null; count: number }>();
  const archetypeCounts = new Map<number, { name: string | null; count: number }>();
  const tuningCounts = new Map<number, { name: string | null; count: number }>();

  for (const p of items) {
    perSlot[p.slot] = (perSlot[p.slot] ?? 0) + 1;
    if (p.setHash !== null) {
      withSetHash++;
      const e = setCounts.get(p.setHash) ?? { name: p.setName, count: 0 };
      e.count++;
      setCounts.set(p.setHash, e);
    }
    if (p.archetypeHash !== null) {
      withArchetypeHash++;
      const e =
        archetypeCounts.get(p.archetypeHash) ?? { name: p.archetypeName, count: 0 };
      e.count++;
      archetypeCounts.set(p.archetypeHash, e);
    }
    if (p.tuningHash !== null) {
      withTuningHash++;
      const e = tuningCounts.get(p.tuningHash) ?? { name: p.tuningName, count: 0 };
      e.count++;
      tuningCounts.set(p.tuningHash, e);
    }
    if (
      p.setHash !== null &&
      p.archetypeHash !== null &&
      p.tuningHash !== null
    ) {
      withAllThree++;
    }
  }

  const topN = <K, V extends { count: number }>(m: Map<K, V>) =>
    [...m.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 8)
      .map(([k, v]) => ({ hash: Number(k), ...v }));

  return {
    withSetHash,
    withArchetypeHash,
    withTuningHash,
    withAllThree,
    perSlot,
    topSets: topN(setCounts),
    topArchetypes: topN(archetypeCounts),
    topTunings: topN(tuningCounts),
  };
}

interface ViewMatchReport {
  view: { name: string; setHash: number; archetypeHash: number; tuningHash: number };
  matchingSet: number;
  matchingArchetype: number;
  matchingTuning: number;
  matchingSetAndArch: number;
  matchingSetAndTun: number;
  matchingAll: number;
  matchingSamples: Array<{
    slot: string;
    setName: string | null;
    archetypeName: string | null;
    tuningName: string | null;
  }>;
}

function matchAgainstView(
  items: DerivedArmorPieceJson[],
  view: { name: string; set_hash: number | string | bigint; archetype_hash: number | string | bigint; tuning_hash: number | string | bigint },
): ViewMatchReport {
  const setHash = Number(view.set_hash);
  const archHash = Number(view.archetype_hash);
  const tunHash = Number(view.tuning_hash);

  let matchingSet = 0;
  let matchingArchetype = 0;
  let matchingTuning = 0;
  let matchingSetAndArch = 0;
  let matchingSetAndTun = 0;
  let matchingAll = 0;
  const samples: ViewMatchReport["matchingSamples"] = [];

  for (const p of items) {
    const s = p.setHash === setHash;
    const a = p.archetypeHash === archHash;
    const t = p.tuningHash === tunHash;
    if (s) matchingSet++;
    if (a) matchingArchetype++;
    if (t) matchingTuning++;
    if (s && a) matchingSetAndArch++;
    if (s && t) matchingSetAndTun++;
    if (s && a && t) {
      matchingAll++;
      if (samples.length < 5) {
        samples.push({
          slot: p.slot,
          setName: p.setName,
          archetypeName: p.archetypeName,
          tuningName: p.tuningName,
        });
      }
    }
  }

  return {
    view: {
      name: view.name,
      setHash,
      archetypeHash: archHash,
      tuningHash: tunHash,
    },
    matchingSet,
    matchingArchetype,
    matchingTuning,
    matchingSetAndArch,
    matchingSetAndTun,
    matchingAll,
    matchingSamples: samples,
  };
}
