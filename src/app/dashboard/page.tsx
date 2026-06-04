import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { getCachedInventoryWithSyncedAt } from "@/lib/inventory/sync";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { checkManifestVersion } from "@/lib/manifest/version-check";
import { ManifestStatusBanner } from "@/components/dashboard/manifest-status-banner";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { buildWorkspaceDataHealth } from "@/lib/workspace/workspace-data-health.shared";
import { manifestSelectorsFromLookups } from "@/lib/views/manifest-selectors-from-lookup";
import { buildGridLookupPayload } from "@/lib/views/grid-lookup-payload.server";
import { buildOptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload.server";
import { parseGridFilters } from "@/lib/workspace/grid-filters-schema";
import { listSavedViewsForUser } from "@/lib/saved-views/queries";
import {
  decodeGridFiltersFromShare,
  GRID_FILTERS_SHARE_PARAM,
} from "@/lib/workspace/grid-filters-share";
import { bungieIconUrl } from "@/lib/bungie/constants";

export const dynamic = "force-dynamic";

function parseWorkspaceViewMode(
  value: string | undefined,
): "grid" | "table" | "optimizer" | null {
  if (value === "grid" || value === "table" || value === "optimizer") {
    return value;
  }
  return null;
}

interface DashboardPageProps {
  searchParams: Promise<{
    f?: string;
    savedViewImported?: string;
    mode?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { f, savedViewImported, mode: modeParam } = await searchParams;
  const initialMode = parseWorkspaceViewMode(modeParam) ?? "table";
  const dashboardPath = f
    ? `/dashboard?${GRID_FILTERS_SHARE_PARAM}=${encodeURIComponent(f)}`
    : "/dashboard";

  const session = await getSession();
  if (!session) {
    redirect(`/?returnTo=${encodeURIComponent(dashboardPath)}`);
  }

  const sharedFilters = f ? decodeGridFiltersFromShare(f) : null;
  const invalidShareLink = Boolean(f) && sharedFilters === null;

  const sb = getServiceRoleClient();

  const [userRowRes, cached, lookups, savedViews, versionCheck] = await Promise.all([
    sb
      .from("users")
      .select("display_name, profile_picture_path, grid_filters")
      .eq("id", session.userId)
      .maybeSingle(),
    getCachedInventoryWithSyncedAt(session.userId),
    getManifestLookups(),
    listSavedViewsForUser(session.userId),
    checkManifestVersion(),
  ]);

  const userRow = userRowRes.data;
  const displayName = userRow?.display_name ?? session.displayName;
  const profilePictureUrl =
    userRow?.profile_picture_path &&
    userRow.profile_picture_path.trim().length > 0
      ? bungieIconUrl(userRow.profile_picture_path.trim())
      : null;
  const initialGridFilters =
    sharedFilters ?? parseGridFilters(userRow?.grid_filters ?? null);
  const appliedFromShare = sharedFilters !== null;
  const inventorySyncedAt = cached?.syncedAt ?? null;

  const inventory = cached?.items ?? [];
  const hasInventoryCache = cached !== null;
  const dataHealth = buildWorkspaceDataHealth({
    manifestVersion: lookups.version,
    schemaOutdated: versionCheck.schemaOutdated,
    manifestNeedsSync:
      lookups.version === null ||
      versionCheck.schemaOutdated ||
      versionCheck.needsResync,
    inventorySyncedAt,
    inventoryPieceCount: inventory.length,
    hasInventoryCache,
  });

  const selectors = manifestSelectorsFromLookups(lookups);
  const lookupPayload = buildGridLookupPayload(lookups);
  const optimizerLookup = buildOptimizerLookupPayload(lookups);

  const banners = dataHealth.manifestNeedsSync ? (
    <ManifestStatusBanner
      manifestVersion={lookups.version}
      versionCheck={versionCheck}
    />
  ) : null;

  return (
    <DashboardWorkspace
      displayName={displayName}
      profilePictureUrl={profilePictureUrl}
      banners={banners}
      syncWarning={null}
      dataHealth={dataHealth}
      hasInventory={hasInventoryCache}
      selectors={selectors}
      inventory={inventory}
      lookupPayload={lookupPayload}
      optimizerLookup={optimizerLookup}
      initialGridFilters={initialGridFilters}
      initialSavedViews={savedViews}
      appliedFromShare={appliedFromShare}
      invalidShareLink={invalidShareLink}
      savedViewImportedId={savedViewImported ?? null}
      initialMode={initialMode}
    />
  );
}
