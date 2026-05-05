import { redirect } from "next/navigation";
import { Info, Warning } from "@phosphor-icons/react/dist/ssr";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import {
  getCachedInventoryWithSyncedAt,
  syncUserInventory,
  InventoryNotReady,
} from "@/lib/inventory/sync";
import { listViewsForUser } from "@/lib/views/queries";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { checkManifestVersion } from "@/lib/manifest/version-check";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";
import { buildSerializableTrackerPayload } from "@/lib/workspace/build-tracker-payload";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { manifestSelectorsFromLookups } from "@/lib/views/manifest-selectors-from-lookup";
import { parseWorkspaceCamera } from "@/lib/workspace/workspace-schema";
import { bungieIconUrl } from "@/lib/bungie/constants";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ tracker?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const rawTracker = typeof sp?.tracker === "string" ? sp.tracker.trim() : "";
  const focusTrackerId =
    rawTracker.length > 0 && /^[\da-f-]{36}$/i.test(rawTracker)
      ? rawTracker
      : null;

  const sb = getServiceRoleClient();
  const { data: userRow } = await sb
    .from("users")
    .select("display_name, workspace_camera, profile_picture_path")
    .eq("id", session.userId)
    .maybeSingle();
  const displayName = userRow?.display_name ?? session.displayName;
  const profilePictureUrl =
    userRow?.profile_picture_path &&
    userRow.profile_picture_path.trim().length > 0
      ? bungieIconUrl(userRow.profile_picture_path.trim())
      : null;
  const initialCamera = parseWorkspaceCamera(userRow?.workspace_camera ?? null);

  let syncWarning: string | null = null;
  try {
    const inv = await syncUserInventory(session, { force: false });
    if (inv.equipmentOnlyRestricted) {
      syncWarning =
        inv.warnings[0] ??
        "Bungie only returned equipped armor. Reconnect Bungie to restore full vault access.";
    }
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

  const trackerPayloads = views.map((view) =>
    buildSerializableTrackerPayload(view, lookups, inventory),
  );

  const selectors = manifestSelectorsFromLookups(lookups);

  const banners = (
    <>
      {!lookups.version ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
        >
          <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
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
          <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
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
          <Info weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div className="flex-1">
            <p className="font-medium">A new Destiny manifest is available</p>
            <p className="text-muted-foreground">
              Cached version{" "}
              <code className="font-mono text-xs">{versionCheck.cachedVersion}</code>
              {" "}
              &rarr; live version{" "}
              <code className="font-mono text-xs">{versionCheck.liveVersion}</code>.
            </p>
          </div>
          <div className="shrink-0 sm:self-center">
            <SyncManifestButton variant="secondary" label="Resync" />
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <DashboardWorkspace
      displayName={displayName}
      profilePictureUrl={profilePictureUrl}
      banners={banners}
      initialTrackers={trackerPayloads}
      initialCamera={initialCamera}
      focusTrackerId={focusTrackerId}
      syncWarning={syncWarning}
      hasInventory={cached !== null}
      selectors={selectors}
      inventory={inventory}
    />
  );
}
