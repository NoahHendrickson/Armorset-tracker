import { redirect } from "next/navigation";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { AppHeader } from "@/components/app-header";
import { NewViewForm } from "@/components/views/new-view-form";

export const dynamic = "force-dynamic";

export default async function NewViewPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const sb = getServiceRoleClient();
  const { data: user } = await sb
    .from("users")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();
  const displayName = user?.display_name ?? session.displayName;

  const lookups = await getManifestLookups();

  // Group sets by which class actually has pieces in them. The "Ferropotent"
  // set has Warlock/Hunter/Titan variants; we want a class-scoped picker so a
  // Warlock view doesn't list sets that only have Titan helmets in our DB.
  const setsForClass: Record<0 | 1 | 2, Set<number>> = {
    0: new Set(),
    1: new Set(),
    2: new Set(),
  };
  for (const info of lookups.armorItemByHash.values()) {
    if (info.classType === 0 || info.classType === 1 || info.classType === 2) {
      setsForClass[info.classType].add(info.setHash);
    }
  }

  const allSets = [...lookups.setNameByHash.entries()]
    .map(([hash, name]) => ({ hash, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const setsByClass = {
    0: allSets.filter((s) => setsForClass[0].has(s.hash)),
    1: allSets.filter((s) => setsForClass[1].has(s.hash)),
    2: allSets.filter((s) => setsForClass[2].has(s.hash)),
  };

  const archetypes = [...lookups.archetypeNameByHash.entries()].map(
    ([hash, name]) => ({ hash, name }),
  );
  const tunings = [...lookups.tuningNameByHash.entries()].map(
    ([hash, name]) => ({ hash, name }),
  );

  const manifestEmpty =
    allSets.length === 0 || archetypes.length === 0 || tunings.length === 0;

  return (
    <>
      <AppHeader displayName={displayName} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 sm:px-6 py-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New view</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the class, set, archetype, and tuning combo you&rsquo;re
              chasing.
            </p>
          </div>
          {manifestEmpty ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium">Manifest not synced</p>
                <p className="text-muted-foreground">
                  Selectors are empty until the manifest is loaded. Trigger a
                  sync with{" "}
                  <code className="font-mono text-xs">
                    POST /api/admin/manifest/sync
                  </code>
                  .
                </p>
              </div>
            </div>
          ) : null}
          <NewViewForm
            setsByClass={setsByClass}
            archetypes={archetypes}
            tunings={tunings}
          />
        </div>
      </main>
    </>
  );
}
