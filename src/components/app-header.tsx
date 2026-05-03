import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";
import { BungieProfileAvatar } from "@/components/bungie-profile-avatar";

interface AppHeaderProps {
  displayName: string;
  /** Absolute URL from `bungieIconUrl(profile_picture_path)` */
  profilePictureUrl?: string | null;
}

/**
 * Top nav: brand cluster (ASB+TT), compact icon actions, profile + sign-out.
 */
export function AppHeader({ displayName, profilePictureUrl }: AppHeaderProps) {
  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex flex-col gap-3 px-3 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4 sm:pt-4">
      <Link
        href="/dashboard"
        className="pointer-events-auto flex items-center gap-2 rounded-none border border-[#4d4e4e] bg-[#2e2f2f] px-2.5 py-2 text-left transition-colors hover:bg-[#353636] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img
          src="/skull.svg"
          alt=""
          width={17}
          height={24}
          className="h-6 w-auto shrink-0"
          aria-hidden
        />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-medium tracking-tight text-white">
            ASB+TT
          </span>
          <span className="text-[11px] font-normal leading-snug text-white/50 sm:text-xs">
            armorsetbonus+tuningtracker
          </span>
        </div>
      </Link>

      <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 sm:gap-3">
        <RefreshButton variant="header-large" />
        <SyncManifestButton variant="header-large" />

        <div className="flex items-stretch gap-0.5 rounded-none border border-white/10 bg-[#2e2f2f]">
          <div className="flex min-w-0 max-w-[min(100vw-10rem,20rem)] items-center gap-2 px-2 py-1 sm:max-w-none sm:gap-2.5 sm:px-2.5">
            <BungieProfileAvatar
              displayName={displayName}
              profilePictureUrl={profilePictureUrl}
              size="lg"
            />
            <span className="truncate text-sm font-medium text-white">
              {displayName}
            </span>
          </div>
          <form action="/api/auth/logout" method="POST" className="contents">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-l border-white/15 text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35"
            >
              <SignOut weight="duotone" className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
