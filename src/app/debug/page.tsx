import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { getCachedInventory } from "@/lib/inventory/sync";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { CLASS_NAMES, bungieIconUrl } from "@/lib/bungie/constants";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

interface DebugPageProps {
  searchParams: Promise<{ set?: string; class?: string }>;
}

export default async function DebugPage({ searchParams }: DebugPageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const sb = getServiceRoleClient();
  const { data: headerUser } = await sb
    .from("users")
    .select("display_name, profile_picture_path")
    .eq("id", session.userId)
    .maybeSingle();
  const headerDisplayName = headerUser?.display_name ?? session.displayName;
  const profilePictureUrl =
    headerUser?.profile_picture_path &&
    headerUser.profile_picture_path.trim().length > 0
      ? bungieIconUrl(headerUser.profile_picture_path.trim())
      : null;

  const { set: setFilter, class: classFilter } = await searchParams;

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
    sampleStatPairsRes,
    sampleStatPlugsRes,
    sampleStatIconsRes,
    lookups,
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
    sb.from("archetype_stat_pairs").select("*").limit(10),
    sb.from("armor_stat_plugs").select("*").limit(20),
    sb.from("armor_stat_icons").select("*").limit(20),
    getManifestLookups(),
  ]);

  const items = inventory ?? [];

  const piecesWithTertiaryField = items.filter(
    (p) => "tertiaryStat" in p,
  ).length;
  const piecesWithTertiaryStat = items.filter(
    (p) => p.tertiaryStat !== null && p.tertiaryStat !== undefined,
  ).length;
  const piecesWithPrimaryStat = items.filter(
    (p) => p.primaryStat !== null && p.primaryStat !== undefined,
  ).length;

  // Show armor sets matching the same set filter so we can see if e.g.
  // "AION Adapter" and "AION Renewal" are genuinely distinct sets in the
  // manifest or an artifact of the deriver.
  const matchingSetEntries = setFilter
    ? [...lookups.setNameByHash.entries()].filter(([, name]) =>
        name.toLowerCase().includes(setFilter.toLowerCase()),
      )
    : [];

  // For each matching set, count how many manifest items it has per class.
  const matchingSets = matchingSetEntries.map(([hash, name]) => {
    const counts: Record<number, number> = {};
    for (const [, info] of lookups.armorItemByHash) {
      if (info.setHash === hash) {
        counts[info.classType] = (counts[info.classType] ?? 0) + 1;
      }
    }
    return { setHash: hash, name, counts };
  });

  const filteredItems = items.filter((p) => {
    if (setFilter) {
      const lower = (p.setName ?? "").toLowerCase();
      if (!lower.includes(setFilter.toLowerCase())) return false;
    }
    if (classFilter !== undefined && classFilter !== "") {
      const cls = Number(classFilter);
      if (Number.isFinite(cls) && p.classType !== cls) return false;
    }
    return true;
  });

  const inventorySample = (setFilter || classFilter
    ? filteredItems
    : items.slice(0, 8)
  ).map((p) => ({
    slot: p.slot,
    classType: p.classType,
    className: p.classType !== null ? CLASS_NAMES[p.classType] : null,
    itemHash: p.itemHash,
    itemInstanceId: p.itemInstanceId,
    setName: p.setName,
    setHash: p.setHash,
    archetype: p.archetypeName,
    archetypeHash: p.archetypeHash,
    tuning: p.tuningName,
    tuningHash: p.tuningHash,
    primary: p.primaryStat,
    secondary: p.secondaryStat,
    tertiary: p.tertiaryStat,
    location: p.location,
  }));

  // Sanity check: how does the manifest's `armor_items.class_type` for each
  // of this user's actual pieces compare to what we wrote into the cached
  // inventory? Mismatches would mean classType derivation is off.
  const classTypeMismatches = setFilter
    ? filteredItems
        .map((p) => {
          const manifestEntry = lookups.armorItemByHash.get(p.itemHash);
          if (!manifestEntry) return null;
          if (manifestEntry.classType === p.classType) return null;
          return {
            itemHash: p.itemHash,
            slot: p.slot,
            setName: p.setName,
            cachedClassType: p.classType,
            manifestClassType: manifestEntry.classType,
          };
        })
        .filter(Boolean)
    : [];

  return (
    <>
      <AppHeader
        displayName={headerDisplayName}
        profilePictureUrl={profilePictureUrl}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-[92px] sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Debug</h1>

        <h2 className="mt-6 text-lg font-semibold">Manifest table counts</h2>
        <Pre>
          {JSON.stringify(
            {
              armor_sets: sets.count ?? 0,
              armor_items: armorItems.count ?? 0,
              archetypes: archetypes.count ?? 0,
              tunings: tunings.count ?? 0,
              plug_to_archetype: plugArch.count ?? 0,
              plug_to_tuning: plugTun.count ?? 0,
              archetype_stat_pairs: statPairs.count ?? 0,
              armor_stat_plugs: statPlugs.count ?? 0,
              armor_stat_icons: statIcons.count ?? 0,
            },
            null,
            2,
          )}
        </Pre>

        <h2 className="mt-6 text-lg font-semibold">In-memory lookup sizes</h2>
        <Pre>
          {JSON.stringify(
            {
              setNameByHash: lookups.setNameByHash.size,
              canonicalSetHashByLegacy: lookups.canonicalSetHashByLegacy.size,
              armorItemByHash: lookups.armorItemByHash.size,
              archetypeNameByHash: lookups.archetypeNameByHash.size,
              tuningNameByHash: lookups.tuningNameByHash.size,
              archetypeByPlug: lookups.archetypeByPlug.size,
              tuningByPlug: lookups.tuningByPlug.size,
              archetypeStatPair: lookups.archetypeStatPair.size,
              statPlug: lookups.statPlug.size,
              statIconByName: lookups.statIconByName.size,
            },
            null,
            2,
          )}
        </Pre>

        <h2 className="mt-6 text-lg font-semibold">archetype_stat_pairs (sample)</h2>
        <Pre>{JSON.stringify(sampleStatPairsRes.data ?? [], null, 2)}</Pre>

        <h2 className="mt-6 text-lg font-semibold">armor_stat_plugs (sample)</h2>
        <Pre>{JSON.stringify(sampleStatPlugsRes.data ?? [], null, 2)}</Pre>

        <h2 className="mt-6 text-lg font-semibold">armor_stat_icons (sample)</h2>
        <Pre>{JSON.stringify(sampleStatIconsRes.data ?? [], null, 2)}</Pre>

        <h2 className="mt-6 text-lg font-semibold">Cached inventory shape</h2>
        <Pre>
          {JSON.stringify(
            {
              total: items.length,
              piecesWithPrimaryStat,
              piecesWithTertiaryStat,
              piecesWithTertiaryField,
            },
            null,
            2,
          )}
        </Pre>

        {setFilter ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">
              Manifest sets matching &quot;{setFilter}&quot; ({matchingSets.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              counts shown as classType → number of manifest items in that
              set/class. classType: 0=Titan, 1=Hunter, 2=Warlock.
            </p>
            <Pre>{JSON.stringify(matchingSets, null, 2)}</Pre>
          </>
        ) : null}

        <h2 className="mt-6 text-lg font-semibold">
          Inventory sample
          {setFilter || classFilter
            ? ` (filtered ${filteredItems.length} of ${items.length})`
            : ` (first 8 of ${items.length})`}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Filter via query params, e.g.{" "}
          <code>?set=AION&amp;class=2</code> (0=Titan, 1=Hunter, 2=Warlock).
        </p>
        <Pre>{JSON.stringify(inventorySample, null, 2)}</Pre>

        {setFilter ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">
              classType mismatches (cached vs manifest)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Empty array is the happy path. Anything here means the cached
              piece&apos;s classType disagrees with the manifest.
            </p>
            <Pre>{JSON.stringify(classTypeMismatches, null, 2)}</Pre>
          </>
        ) : null}
      </main>
    </>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
      {children}
    </pre>
  );
}
