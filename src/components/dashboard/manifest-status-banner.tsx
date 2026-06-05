import { Info, Warning } from "@phosphor-icons/react/dist/ssr";
import type { ManifestVersionCheckResult } from "@/lib/manifest/version-check";

/**
 * Advisory manifest banner on the dashboard when sync or re-derive is needed.
 * The page only mounts this when {@link buildWorkspaceDataHealth}'s
 * `manifestNeedsSync` is true — callers pass the version check from the same
 * server request so this stays synchronous.
 */
export function ManifestStatusBanner({
  manifestVersion,
  versionCheck,
}: {
  manifestVersion: string | null;
  versionCheck: ManifestVersionCheckResult;
}) {
  if (!manifestVersion) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-none border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
      >
        <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-medium">Loading Destiny manifest</p>
        </div>
      </div>
    );
  }

  if (versionCheck.schemaOutdated) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-none border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-start"
      >
        <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-medium">Updating manifest data</p>
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
          <p className="font-medium">
            Updating to a new Bungie manifest (
            <code className="font-mono text-xs">{versionCheck.cachedVersion}</code>
            {" → "}
            <code className="font-mono text-xs">{versionCheck.liveVersion}</code>
            )
          </p>
        </div>
      </div>
    );
  }

  return null;
}
