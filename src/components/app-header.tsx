import Link from "next/link";
import { Shield, SignOut } from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";

interface AppHeaderProps {
  displayName: string;
}

/**
 * Extract up to two initials from a Bungie display name like "noey#8868" or
 * "Player Name". Strips the `#NNNN` suffix and falls back to "?" on empty.
 */
function initialsFor(name: string): string {
  const base = name.split("#")[0]?.trim() ?? "";
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function AppHeader({ displayName }: AppHeaderProps) {
  return (
    <header className="fixed left-3 right-3 top-3 z-40 flex h-14 items-center justify-between gap-4 border border-[#424347] bg-[#2d2e32]/85 px-4 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.55)] backdrop-blur-md sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Shield weight="duotone" className="h-6 w-6" />
        <span className="text-base">Armor Set Checklist</span>
      </Link>

      <div className="flex items-center gap-2">
        <RefreshButton variant="header-icon" />
        <SyncManifestButton variant="header-icon" />

        <div className="ml-2 flex h-10 items-center overflow-hidden border border-[#5c5d60] bg-[#3f4044]">
          <div className="flex items-center gap-2 pl-2 pr-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white"
            >
              {initialsFor(displayName)}
            </span>
            <span className="hidden text-sm font-medium text-white sm:inline">
              {displayName}
            </span>
          </div>
          <Link
            href="/api/auth/logout"
            aria-label="Sign out"
            title="Sign out"
            className="flex h-full w-10 items-center justify-center border-l border-[#5c5d60] text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
          >
            <SignOut weight="duotone" className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
