import { Info, Warning } from "@phosphor-icons/react/dist/ssr";
import { checkManifestVersion } from "@/lib/manifest/version-check";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";

/**
 * Advisory manifest banner. Rendered inside a `<Suspense>` boundary on the
 * dashboard so the workspace can paint immediately — the version check makes a
 * live Bungie request and must never block first paint.
 */
export async function ManifestStatusBanner({
  manifestVersion,
}: {
  manifestVersion: string | null;
}) {
  if (!manifestVersion) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-none border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
      >
        <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-medium">Manifest not synced</p>
          <p className="text-muted-foreground">
            Sets, archetypes, and tunings won&rsquo;t populate until the
            manifest is loaded. This pulls a few MB of Destiny definitions from
            Bungie and may take 30–60 seconds.
          </p>
        </div>
        <div className="shrink-0 sm:self-center">
          <SyncManifestButton label="Sync now" />
        </div>
      </div>
    );
  }

  const versionCheck = await checkManifestVersion();

  if (versionCheck.schemaOutdated) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-none border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
      >
        <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-medium">Manifest needs to be re-derived</p>
          <p className="text-muted-foreground">
            New derived tables were added by a schema migration but haven&rsquo;t
            been populated yet. Run a resync to backfill archetype stat pairs and
            stat plugs.
          </p>
        </div>
        <div className="shrink-0 sm:self-center">
          <SyncManifestButton label="Resync" />
        </div>
      </div>
    );
  }

  if (versionCheck.needsResync) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-none border border-blue-500/30 bg-blue-500/5 p-4 text-sm sm:flex-row sm:items-start"
      >
        <Info weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
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
    );
  }

  return null;
}
