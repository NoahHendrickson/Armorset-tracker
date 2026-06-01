import "server-only";

import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import { getServiceRoleClient } from "@/lib/db/server";
import type { ArmorStatName } from "@/lib/db/types";
import { buildDestinyStatHashToArmorStat } from "@/lib/inventory/armor-stat-destiny-hashes";
import { mergeExoticStatTotals } from "@/lib/manifest/exotic-stat-budget";
import { exoticPieceIdentityKey } from "@/lib/optimizer/exotic-lock";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ManifestLookups {
  version: string | null;
  archetypeNameByHash: Map<number, string>;
  tuningNameByHash: Map<number, string>;
  setNameByHash: Map<number, string>;
  /** Legacy `djb2` name fingerprint → current `equipableItemSetHash` (armor_sets.set_hash). */
  canonicalSetHashByLegacy: Map<number, number>;
  archetypeByPlug: Map<number, number>;
  tuningByPlug: Map<number, number>;
  armorItemByHash: Map<
    number,
    { setHash: number; slot: ArmorSlot; classType: number; iconPath: string }
  >;
  /** Exotic armor (manifest tierType 6) keyed by item hash. No equipable set. */
  exoticArmorByHash: Map<
    number,
    { slot: ArmorSlot; classType: number; name: string; iconPath: string }
  >;
  /** Manifest investmentStats for exotics without Armor 3.0 intrinsic plugs. */
  exoticStatBudgetByItemHash: Map<
    number,
    Partial<Record<ArmorStatName, number>>
  >;
  /** Slot + normalized display name → merged manifest budgets (reissued hashes). */
  exoticStatBudgetByIdentity: Map<
    string,
    Partial<Record<ArmorStatName, number>>
  >;
  archetypeStatPair: Map<
    number,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >;
  statPlug: Map<number, { stat: ArmorStatName; value: number }>;
  /** Tuning plug hash → stat deltas (+/-) from manifest investmentStats. */
  tuningPlugStats: Map<number, Array<{ stat: ArmorStatName; value: number }>>;
  /** Subclass fragment plug hash → display + armor stat deltas. */
  fragmentPlugByHash: Map<
    number,
    {
      name: string;
      iconPath: string;
      subclassKey: string;
      deltas: Array<{ stat: ArmorStatName; value: number }>;
    }
  >;
  armorSetPerks: Array<{
    setHash: number;
    setName: string;
    requiredSetCount: number;
    perkHash: number;
    name: string;
    description: string;
    iconPath: string;
  }>;
  /** Relative icon paths from DestinyStatDefinition (prefix with bungie.net). */
  statIconByName: Map<ArmorStatName, string>;
  /** Bungie `statTypeHash` → Armor 3.0 stat (profile ItemStats component 304). */
  destinyStatHashToArmorStat: Map<number, ArmorStatName>;
  /** `armor_items` thumbnails keyed `${set_hash}:${class_type}:${slot}`. */
  armorSlotIconPathBySetClassSlot: Map<string, string>;
  /** Weak fallback when no row matches `(set × class)` — first manifest icon seen per slot. */
  slotFallbackIconPathBySlot: Map<ArmorSlot, string>;
}

export type ArmorCatalogEntry =
  | {
      kind: "legendary";
      setHash: number;
      slot: ArmorSlot;
      classType: number;
      iconPath: string;
      setName: string | null;
    }
  | {
      kind: "exotic";
      slot: ArmorSlot;
      classType: number;
      iconPath: string;
      name: string;
    };

/** Legendary set row or exotic one-off for a manifest item hash, if known. */
export function resolveArmorCatalogItem(
  lookups: ManifestLookups,
  itemHash: number,
): ArmorCatalogEntry | null {
  const exotic = lookups.exoticArmorByHash.get(itemHash);
  if (exotic) {
    return {
      kind: "exotic",
      slot: exotic.slot,
      classType: exotic.classType,
      iconPath: exotic.iconPath,
      name: exotic.name,
    };
  }
  const legendary = lookups.armorItemByHash.get(itemHash);
  if (!legendary) return null;
  return {
    kind: "legendary",
    setHash: legendary.setHash,
    slot: legendary.slot,
    classType: legendary.classType,
    iconPath: legendary.iconPath,
    setName: lookups.setNameByHash.get(legendary.setHash) ?? null,
  };
}

/** Stable lookup key into {@link ManifestLookups.armorSlotIconPathBySetClassSlot}. */
export function armorItemIconLookupKey(
  setHash: number,
  classType: number,
  slot: ArmorSlot,
): string {
  return `${setHash}:${classType}:${slot}`;
}

/**
 * Tracker row thumbnails from `armor_items`: exact match on canonical set hash +
 * view class where possible.
 */
export function armorSlotIconPathsForView(
  lookups: ManifestLookups,
  resolvedSetHash: number,
  viewClassType: number,
): Partial<Record<ArmorSlot, string>> {
  const out: Partial<Record<ArmorSlot, string>> = {};
  for (const slot of SLOT_ORDER) {
    let path: string | undefined;

    if (viewClassType >= 0) {
      path = lookups.armorSlotIconPathBySetClassSlot.get(
        armorItemIconLookupKey(resolvedSetHash, viewClassType, slot),
      );
    } else {
      for (const cls of [0, 1, 2, 3] as const) {
        path = lookups.armorSlotIconPathBySetClassSlot.get(
          armorItemIconLookupKey(resolvedSetHash, cls, slot),
        );
        if (path) break;
      }
    }

    if (!path) path = lookups.slotFallbackIconPathBySlot.get(slot);
    if (path) out[slot] = path;
  }
  return out;
}

let cached: { at: number; data: ManifestLookups } | null = null;
const TTL_MS = 60 * 1000;

const PAGE_SIZE = 1000;

// Supabase REST caps responses at 1000 rows by default. `armor_items` and
// `armor_sets` can exceed that, so paginate via `.range(start, end)`.
async function paginatedSelect<T>(
  builder: () => ReturnType<SupabaseClient["from"]>["select"] extends (...a: never[]) => infer R ? R : never,
  /* eslint-disable @typescript-eslint/no-explicit-any */
): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  // We don't know the row count up front; loop until we get a short page.
  for (;;) {
    const { data, error } = await (builder() as any).range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(`paginated select failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return out;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function isMissingTableError(message: string): boolean {
  return (
    message.includes("Could not find the table") ||
    /relation .+ does not exist/i.test(message)
  );
}

function isMissingColumnError(message: string): boolean {
  return /column .+ does not exist/i.test(message);
}

type ExoticArmorLookupRow = {
  item_hash: number | string;
  slot: string;
  class_type: number;
  name: string;
  icon_path: string | null;
  stat_totals?: Partial<Record<ArmorStatName, number>> | null;
};

type ArmorStatIconRow = {
  stat: ArmorStatName;
  icon_path: string;
  destiny_stat_hash?: number | string | null;
};

/** Supports DBs before migration 0021 (`armor_stat_icons.destiny_stat_hash`). */
async function paginatedSelectArmorStatIcons(
  sb: SupabaseClient,
): Promise<ArmorStatIconRow[]> {
  try {
    return await paginatedSelect<ArmorStatIconRow>(() =>
      sb.from("armor_stat_icons").select("stat, icon_path, destiny_stat_hash"),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingColumnError(message)) throw err;
    return await paginatedSelect<Omit<ArmorStatIconRow, "destiny_stat_hash">>(
      () => sb.from("armor_stat_icons").select("stat, icon_path"),
    );
  }
}

/** Supports DBs before migration 0020 (`exotic_armor.stat_totals`). */
async function paginatedSelectExoticArmor(
  sb: SupabaseClient,
): Promise<ExoticArmorLookupRow[]> {
  try {
    return await paginatedSelect<ExoticArmorLookupRow>(() =>
      sb
        .from("exotic_armor")
        .select("item_hash, slot, class_type, name, icon_path, stat_totals"),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingColumnError(message)) throw err;
    const rows = await paginatedSelect<
      Omit<ExoticArmorLookupRow, "stat_totals">
    >(() =>
      sb
        .from("exotic_armor")
        .select("item_hash, slot, class_type, name, icon_path"),
    );
    return rows.map((row) => ({ ...row, stat_totals: null }));
  }
}

/** Like `paginatedSelect`, but returns [] when the table is not migrated yet. */
async function paginatedSelectOptional<T>(
  builder: Parameters<typeof paginatedSelect<T>>[0],
): Promise<T[]> {
  try {
    return await paginatedSelect(builder);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) return [];
    throw err;
  }
}

export async function getManifestLookups(force = false): Promise<ManifestLookups> {
  const sb = getServiceRoleClient();
  const now = Date.now();
  const cacheFresh = Boolean(cached && now - cached.at < TTL_MS);

  if (!force && cacheFresh && cached) {
    const hasStats = cached.data.statIconByName.size > 0;
    const hasArmorThumbs =
      cached.data.armorSlotIconPathBySetClassSlot.size > 0;
    if (hasStats && hasArmorThumbs) {
      return cached.data;
    }

    const { count: iconRows } = await sb
      .from("armor_stat_icons")
      .select("*", { count: "exact", head: true });
    if ((iconRows ?? 0) === 0) {
      return cached.data;
    }

    const { count: armorThumbRows } = await sb
      .from("armor_items")
      .select("*", { count: "exact", head: true })
      .neq("icon_path", "");
    if ((armorThumbRows ?? 0) === 0) {
      return cached.data;
    }
  }

  const [
    versionRes,
    armorSets,
    armorItems,
    exoticArmor,
    archetypes,
    tunings,
    plugToArchetype,
    plugToTuning,
    archetypeStatPairs,
    armorStatPlugs,
    tuningPlugStatRows,
    subclassFragmentPlugs,
    subclassFragmentPlugStatRows,
    armorStatIcons,
    armorSetPerkRows,
  ] = await Promise.all([
    sb
      .from("manifest_versions")
      .select("version")
      .eq("is_active", true)
      .maybeSingle(),
    paginatedSelect<{
      set_hash: number | string;
      name: string;
      legacy_set_hash?: number | string | null;
      legacy_set_hashes?: number[] | string[] | null;
    }>(() =>
      sb
        .from("armor_sets")
        .select("set_hash, name, legacy_set_hash, legacy_set_hashes"),
    ),
    paginatedSelect<{
      item_hash: number | string;
      set_hash: number | string;
      slot: string;
      class_type: number;
      icon_path: string | null;
    }>(() =>
      sb.from("armor_items").select("item_hash, set_hash, slot, class_type, icon_path"),
    ),
    paginatedSelectExoticArmor(sb),
    paginatedSelect<{ archetype_hash: number | string; name: string }>(
      () => sb.from("archetypes").select("archetype_hash, name"),
    ),
    paginatedSelect<{ tuning_hash: number | string; name: string }>(
      () => sb.from("tunings").select("tuning_hash, name"),
    ),
    paginatedSelect<{ plug_hash: number | string; archetype_hash: number | string }>(
      () => sb.from("plug_to_archetype").select("plug_hash, archetype_hash"),
    ),
    paginatedSelect<{ plug_hash: number | string; tuning_hash: number | string }>(
      () => sb.from("plug_to_tuning").select("plug_hash, tuning_hash"),
    ),
    paginatedSelect<{
      archetype_hash: number | string;
      primary_stat: ArmorStatName;
      secondary_stat: ArmorStatName;
    }>(() =>
      sb
        .from("archetype_stat_pairs")
        .select("archetype_hash, primary_stat, secondary_stat"),
    ),
    paginatedSelect<{ plug_hash: number | string; stat: ArmorStatName; value: number }>(
      () => sb.from("armor_stat_plugs").select("plug_hash, stat, value"),
    ),
    paginatedSelect<{ plug_hash: number | string; stat: ArmorStatName; value: number }>(
      () => sb.from("tuning_plug_stats").select("plug_hash, stat, value"),
    ),
    paginatedSelectOptional<{
      plug_hash: number | string;
      name: string;
      icon_path: string | null;
      subclass_key?: string | null;
    }>(() =>
      sb.from("subclass_fragment_plugs").select("plug_hash, name, icon_path, subclass_key"),
    ),
    paginatedSelectOptional<{
      plug_hash: number | string;
      stat: ArmorStatName;
      value: number;
    }>(() =>
      sb
        .from("subclass_fragment_plug_stats")
        .select("plug_hash, stat, value"),
    ),
    paginatedSelectArmorStatIcons(sb),
    paginatedSelectOptional<{
      set_hash: number | string;
      required_set_count: number;
      sandbox_perk_hash: number | string;
      name: string;
      description: string | null;
      icon_path: string | null;
    }>(() =>
      sb
        .from("armor_set_perks")
        .select(
          "set_hash, required_set_count, sandbox_perk_hash, name, description, icon_path",
        ),
    ),
  ]);

  const canonicalSetHashByLegacy = new Map<number, number>();
  for (const r of armorSets) {
    const canon = Number(r.set_hash);
    const rawArr = r.legacy_set_hashes;
    const fromArray =
      Array.isArray(rawArr) && rawArr.length > 0
        ? rawArr.map((h) => Number(h)).filter((n) => Number.isFinite(n))
        : [];
    const hashes =
      fromArray.length > 0
        ? fromArray
        : r.legacy_set_hash != null && r.legacy_set_hash !== ""
          ? [Number(r.legacy_set_hash)]
          : [];
    for (const L of hashes) {
      if (!canonicalSetHashByLegacy.has(L)) {
        canonicalSetHashByLegacy.set(L, canon);
      }
    }
  }

  const armorSlotIconPathBySetClassSlot = new Map<string, string>();
  const slotFallbackIconPathBySlot = new Map<ArmorSlot, string>();
  for (const r of armorItems) {
    const path = String(r.icon_path ?? "").trim();
    if (!path) continue;
    const slot = r.slot as ArmorSlot;
    const setHash = Number(r.set_hash);
    const classType = Number(r.class_type);
    const key = armorItemIconLookupKey(setHash, classType, slot);
    if (!armorSlotIconPathBySetClassSlot.has(key)) {
      armorSlotIconPathBySetClassSlot.set(key, path);
    }
    if (!slotFallbackIconPathBySlot.has(slot)) {
      slotFallbackIconPathBySlot.set(slot, path);
    }
  }

  const data: ManifestLookups = {
    version: versionRes.data?.version ?? null,
    setNameByHash: new Map(armorSets.map((r) => [Number(r.set_hash), r.name])),
    canonicalSetHashByLegacy,
    armorItemByHash: new Map(
      armorItems.map((r) => [
        Number(r.item_hash),
        {
          setHash: Number(r.set_hash),
          slot: r.slot as ArmorSlot,
          classType: Number(r.class_type),
          iconPath: String(r.icon_path ?? "").trim(),
        },
      ]),
    ),
    exoticArmorByHash: new Map(
      exoticArmor.map((r) => [
        Number(r.item_hash),
        {
          slot: r.slot as ArmorSlot,
          classType: Number(r.class_type),
          name: r.name,
          iconPath: String(r.icon_path ?? "").trim(),
        },
      ]),
    ),
    exoticStatBudgetByItemHash: new Map(
      exoticArmor
        .map((r) => {
          const totals = r.stat_totals;
          if (totals == null || typeof totals !== "object") return null;
          if (Object.keys(totals).length === 0) return null;
          return [Number(r.item_hash), totals] as const;
        })
        .filter((entry): entry is readonly [number, Partial<Record<ArmorStatName, number>>] =>
          entry != null,
        ),
    ),
    exoticStatBudgetByIdentity: (() => {
      const byIdentity = new Map<
        string,
        Partial<Record<ArmorStatName, number>>
      >();
      for (const r of exoticArmor) {
        const totals = r.stat_totals;
        if (totals == null || typeof totals !== "object") continue;
        if (Object.keys(totals).length === 0) continue;
        const itemHash = Number(r.item_hash);
        const identityKey = exoticPieceIdentityKey({
          itemInstanceId: "",
          itemHash,
          slot: r.slot as ArmorSlot,
          classType: Number(r.class_type),
          setHash: null,
          setName: null,
          displayName: r.name,
          isExotic: true,
          archetypeHash: null,
          archetypeName: null,
          tuningHash: null,
          tuningName: null,
          primaryStat: null,
          secondaryStat: null,
          tertiaryStat: null,
          location: { kind: "vault" },
        });
        byIdentity.set(
          identityKey,
          mergeExoticStatTotals(byIdentity.get(identityKey) ?? {}, totals),
        );
      }
      return byIdentity;
    })(),
    archetypeNameByHash: new Map(
      archetypes.map((r) => [Number(r.archetype_hash), r.name]),
    ),
    tuningNameByHash: new Map(
      tunings.map((r) => [Number(r.tuning_hash), r.name]),
    ),
    archetypeByPlug: new Map(
      plugToArchetype.map((r) => [
        Number(r.plug_hash),
        Number(r.archetype_hash),
      ]),
    ),
    tuningByPlug: new Map(
      plugToTuning.map((r) => [Number(r.plug_hash), Number(r.tuning_hash)]),
    ),
    archetypeStatPair: new Map(
      archetypeStatPairs.map((r) => [
        Number(r.archetype_hash),
        { primary: r.primary_stat, secondary: r.secondary_stat },
      ]),
    ),
    statPlug: new Map(
      armorStatPlugs.map((r) => [
        Number(r.plug_hash),
        { stat: r.stat, value: r.value },
      ]),
    ),
    tuningPlugStats: (() => {
      const map = new Map<
        number,
        Array<{ stat: ArmorStatName; value: number }>
      >();
      for (const r of tuningPlugStatRows) {
        const plugHash = Number(r.plug_hash);
        const list = map.get(plugHash) ?? [];
        list.push({ stat: r.stat, value: r.value });
        map.set(plugHash, list);
      }
      return map;
    })(),
    fragmentPlugByHash: (() => {
      const deltasByPlug = new Map<
        number,
        Array<{ stat: ArmorStatName; value: number }>
      >();
      for (const r of subclassFragmentPlugStatRows) {
        const plugHash = Number(r.plug_hash);
        const list = deltasByPlug.get(plugHash) ?? [];
        list.push({ stat: r.stat, value: r.value });
        deltasByPlug.set(plugHash, list);
      }
      const map = new Map<
        number,
        {
          name: string;
          iconPath: string;
          subclassKey: string;
          deltas: Array<{ stat: ArmorStatName; value: number }>;
        }
      >();
      for (const r of subclassFragmentPlugs) {
        const plugHash = Number(r.plug_hash);
        map.set(plugHash, {
          name: r.name,
          iconPath: String(r.icon_path ?? "").trim(),
          subclassKey: String(r.subclass_key ?? "unknown"),
          deltas: deltasByPlug.get(plugHash) ?? [],
        });
      }
      return map;
    })(),
    armorSetPerks: (armorSetPerkRows ?? []).map((r) => ({
      setHash: Number(r.set_hash),
      setName:
        armorSets.find((s) => Number(s.set_hash) === Number(r.set_hash))?.name ??
        "Unknown set",
      requiredSetCount: Number(r.required_set_count),
      perkHash: Number(r.sandbox_perk_hash),
      name: r.name,
      description: String(r.description ?? "").trim(),
      iconPath: String(r.icon_path ?? "").trim(),
    })),
    statIconByName: new Map(
      armorStatIcons
        .map((r) => {
          const stat = String(r.stat).trim() as ArmorStatName;
          const path = String(r.icon_path ?? "").trim();
          return path ? ([stat, path] as const) : null;
        })
        .filter((e): e is readonly [ArmorStatName, string] => e !== null),
    ),
    destinyStatHashToArmorStat: buildDestinyStatHashToArmorStat(
      armorStatIcons
        .map((r) => {
          const hash = r.destiny_stat_hash;
          if (hash == null || hash === "") return null;
          const stat = String(r.stat).trim() as ArmorStatName;
          return [Number(hash), stat] as const;
        })
        .filter(
          (entry): entry is readonly [number, ArmorStatName] =>
            entry != null && Number.isFinite(entry[0]),
        ),
    ),
    armorSlotIconPathBySetClassSlot,
    slotFallbackIconPathBySlot,
  };

  cached = { at: Date.now(), data };
  return data;
}

export function invalidateManifestLookups() {
  cached = null;
}

/** If `storedSetHash` is a pre-canonical value, return the current equipable-set hash; otherwise return it unchanged. */
export function resolveViewSetHash(
  storedSetHash: number,
  lookups: ManifestLookups,
): number {
  if (lookups.setNameByHash.has(storedSetHash)) return storedSetHash;
  return lookups.canonicalSetHashByLegacy.get(storedSetHash) ?? storedSetHash;
}
