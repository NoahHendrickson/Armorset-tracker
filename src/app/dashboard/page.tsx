import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { getCachedInventoryWithSyncedAt } from "@/lib/inventory/sync";
import { getManifestLookups } from "@/lib/manifest/lookups";
import { ManifestStatusBanner } from "@/components/dashboard/manifest-status-banner";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { manifestSelectorsFromLookups } from "@/lib/views/manifest-selectors-from-lookup";
import { buildGridLookupPayload } from "@/lib/views/grid-lookup-payload.server";
import { parseGridFilters } from "@/lib/workspace/grid-filters-schema";
import { listSavedViewsForUser } from "@/lib/saved-views/queries";
import {
  decodeGridFiltersFromShare,
  GRID_FILTERS_SHARE_PARAM,
} from "@/lib/workspace/grid-filters-share";
import { bungieIconUrl } from "@/lib/bungie/constants";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ f?: string; savedViewImported?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { f, savedViewImported } = await searchParams;
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

  const [userRowRes, cached, lookups, savedViews] = await Promise.all([
    sb
      .from("users")
      .select("display_name, profile_picture_path, grid_filters")
      .eq("id", session.userId)
      .maybeSingle(),
    getCachedInventoryWithSyncedAt(session.userId),
    getManifestLookups(),
    listSavedViewsForUser(session.userId),
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

  const selectors = manifestSelectorsFromLookups(lookups);
  const lookupPayload = buildGridLookupPayload(lookups);

  const banners = (
    <Suspense fallback={null}>
      <ManifestStatusBanner manifestVersion={lookups.version} />
    </Suspense>
  );

  return (
    <DashboardWorkspace
      displayName={displayName}
      profilePictureUrl={profilePictureUrl}
      banners={banners}
      syncWarning={null}
      inventorySyncedAt={inventorySyncedAt}
      hasInventory={cached !== null}
      selectors={selectors}
      inventory={inventory}
      lookupPayload={lookupPayload}
      initialGridFilters={initialGridFilters}
      initialSavedViews={savedViews}
      appliedFromShare={appliedFromShare}
      invalidShareLink={invalidShareLink}
      savedViewImportedId={savedViewImported ?? null}
    />
  );
}
