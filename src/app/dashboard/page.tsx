import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, Plus, Warning } from "@phosphor-icons/react/dist/ssr";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import {
  getCachedInventoryWithSyncedAt,
  syncUserInventory,
  InventoryNotReady,
} from "@/lib/inventory/sync";
import { listViewsForUser } from "@/lib/views/queries";
import {
  computeViewProgress,
  tertiaryStatsForArchetype,
} from "@/lib/views/progress";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { checkManifestVersion } from "@/lib/manifest/version-check";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";
import { ViewCard } from "@/components/dashboard/view-card";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const sb = getServiceRoleClient();
  const { data: user } = await sb
    .from("users")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();
  const displayName = user?.display_name ?? session.displayName;

  let syncWarning: string | null = null;
  try {
    await syncUserInventory(session, { force: false });
  } catch (err) {
    if (err instanceof InventoryNotReady) {
      syncWarning = err.message;
    } else if (err instanceof Error) {
      syncWarning = err.message;
    } else {
      syncWarning = "Could not load inventory.";
    }
  }

  const [views, cached, lookups, versionCheck] = await Promise.all([
    listViewsForUser(session.userId),
    getCachedInventoryWithSyncedAt(session.userId),
    getManifestLookups(),
    checkManifestVersion(),
  ]);

  const inventory = cached?.items ?? [];
  const syncedAt = cached?.syncedAt ?? null;

  return (
    <>
      <AppHeader displayName={displayName} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Your views</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {syncedAt ? (
                  <>Inventory synced {formatRelativeTime(syncedAt)}</>
                ) : (
                  <>No inventory synced yet</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton />
              <Button asChild>
                <Link href="/views/new">
                  <Plus />
                  New view
                </Link>
              </Button>
            </div>
          </div>

          {!lookups.version ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
            >
              <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium">Manifest not synced</p>
                <p className="text-muted-foreground">
                  Sets, archetypes, and tunings won&rsquo;t populate until the
                  manifest is loaded. This pulls a few MB of Destiny
                  definitions from Bungie and may take 30–60 seconds.
                </p>
              </div>
              <div className="shrink-0 sm:self-center">
                <SyncManifestButton label="Sync now" />
              </div>
            </div>
          ) : versionCheck.schemaOutdated ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
            >
              <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium">Manifest needs to be re-derived</p>
                <p className="text-muted-foreground">
                  New derived tables were added by a schema migration but
                  haven&rsquo;t been populated yet. Run a resync to backfill
                  archetype stat pairs and stat plugs.
                </p>
              </div>
              <div className="shrink-0 sm:self-center">
                <SyncManifestButton label="Resync" />
              </div>
            </div>
          ) : versionCheck.needsResync ? (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm sm:flex-row sm:items-start"
            >
              <Info weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium">A new Destiny manifest is available</p>
                <p className="text-muted-foreground">
                  Cached version{" "}
                  <code className="font-mono text-xs">{versionCheck.cachedVersion}</code>{" "}
                  &rarr; live version{" "}
                  <code className="font-mono text-xs">{versionCheck.liveVersion}</code>.
                </p>
              </div>
              <div className="shrink-0 sm:self-center">
                <SyncManifestButton variant="secondary" label="Resync" />
              </div>
            </div>
          ) : null}

          {syncWarning ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{syncWarning}</span>
            </div>
          ) : null}

          {views.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {views.map((view) => {
                const tertiaryStats = tertiaryStatsForArchetype(
                  lookups.archetypeStatPair.get(Number(view.archetype_hash)),
                );
                const progress = computeViewProgress(
                  view,
                  inventory,
                  tertiaryStats,
                );
                return (
                  <ViewCard
                    key={view.id}
                    view={view}
                    progress={progress}
                    setName={
                      lookups.setNameByHash.get(Number(view.set_hash)) ??
                      "Unknown set"
                    }
                    archetypeName={
                      lookups.archetypeNameByHash.get(Number(view.archetype_hash)) ??
                      "Unknown archetype"
                    }
                    tuningName={
                      lookups.tuningNameByHash.get(Number(view.tuning_hash)) ??
                      "Unknown tuning"
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">No views yet</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Create a checklist by picking an armor set, archetype, and tuning
        stat. The five slots will fill in based on your inventory.
      </p>
      <Button asChild className="mt-4">
        <Link href="/views/new">
          <Plus />
          Create your first view
        </Link>
      </Button>
    </div>
  );
}
