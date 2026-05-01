import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import {
  getCachedInventoryWithSyncedAt,
  syncUserInventory,
  InventoryNotReady,
} from "@/lib/inventory/sync";
import { getViewForUser } from "@/lib/views/queries";
import {
  computeViewProgress,
  computeViewDiagnostics,
  tertiaryStatsForArchetype,
} from "@/lib/views/progress";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ViewActions } from "@/components/views/view-actions";
import { ViewGrid } from "@/components/views/view-grid";
import { ViewDiagnosticsPanel } from "@/components/views/view-diagnostics";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ViewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewPage({ params }: ViewPageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const { id } = await params;
  const view = await getViewForUser(session.userId, id);
  if (!view) notFound();

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
    syncWarning =
      err instanceof InventoryNotReady
        ? err.message
        : err instanceof Error
          ? err.message
          : "Could not load inventory.";
  }

  const [cached, lookups] = await Promise.all([
    getCachedInventoryWithSyncedAt(session.userId),
    getManifestLookups(),
  ]);

  const inventory = cached?.items ?? [];
  const syncedAt = cached?.syncedAt ?? null;
  const archetypePair = lookups.archetypeStatPair.get(Number(view.archetype_hash));
  const tertiaryStats = tertiaryStatsForArchetype(archetypePair);
  const progress = computeViewProgress(view, inventory, tertiaryStats);
  const diagnostics = computeViewDiagnostics(view, inventory, archetypePair !== undefined);
  const needsClass = Number(view.class_type) < 0;
  const showDiagnostics = progress.ownedCells < progress.totalCells;

  const setName =
    lookups.setNameByHash.get(Number(view.set_hash)) ?? "Unknown set";
  const archetypeName =
    lookups.archetypeNameByHash.get(Number(view.archetype_hash)) ??
    "Unknown archetype";
  const tuningName =
    lookups.tuningNameByHash.get(Number(view.tuning_hash)) ??
    "Unknown tuning";
  const className =
    Number(view.class_type) >= 0
      ? CLASS_NAMES[Number(view.class_type)]
      : null;

  return (
    <>
      <AppHeader displayName={displayName} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6">
          <Button asChild variant="ghost" size="sm" className="self-start text-muted-foreground -ml-2">
            <Link href="/dashboard">
              <ArrowLeft />
              All views
            </Link>
          </Button>

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {view.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {className ? <Badge variant="outline">{className}</Badge> : null}
                <Badge variant="outline">{setName}</Badge>
                <Badge variant="outline">{archetypeName}</Badge>
                <Badge variant="outline">{tuningName}</Badge>
                {archetypePair ? (
                  <Badge variant="outline" className="font-mono">
                    +{archetypePair.primary} / +{archetypePair.secondary}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Progress{" "}
                <span className="font-mono">
                  {progress.ownedCells}/{progress.totalCells}
                </span>
                {syncedAt ? (
                  <> &middot; synced {formatRelativeTime(syncedAt)}</>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RefreshButton />
              <ViewActions viewId={view.id} initialName={view.name} />
            </div>
          </header>

          {needsClass ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
            >
              <p className="font-medium">View has no class assigned</p>
              <p className="text-muted-foreground">
                This view was created before class scoping existed. Delete it
                and create a new one to filter by Titan, Hunter, or Warlock.
              </p>
            </div>
          ) : null}

          {syncWarning ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {syncWarning}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <ViewGrid progress={progress} hasInventory={cached !== null} />
          </div>

          {showDiagnostics ? (
            <ViewDiagnosticsPanel
              diagnostics={diagnostics}
              setName={setName}
              archetypeName={archetypeName}
              tuningName={tuningName}
              className={className}
            />
          ) : null}
        </div>
      </main>
    </>
  );
}
