"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { FeedbackHeaderDialog } from "@/components/feedback-header-dialog";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";
import { BungieProfileAvatar } from "@/components/bungie-profile-avatar";
import { chromeSquareIconSegmentClass } from "@/components/ui/chrome-square-icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppHeaderProps {
  displayName: string;
  /** Absolute URL from `bungieIconUrl(profile_picture_path)` */
  profilePictureUrl?: string | null;
  /** Shown immediately to the right of the brand link (e.g. Canvas / Table). */
  leadingAccessory?: ReactNode;
}

/**
 * Top nav: brand cluster (D2 Tuning Tracker), compact icon actions, profile + sign-out.
 */
export function AppHeader({
  displayName,
  profilePictureUrl,
  leadingAccessory,
}: AppHeaderProps) {
  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex flex-col gap-3 px-3 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-none flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-none border border-white/10 bg-[#2d2e32] px-2.5 text-left text-white shadow-lg transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35"
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
          <span className="min-w-0 text-sm font-medium tracking-tight">
            D2 Tuning Tracker
          </span>
        </Link>
        {leadingAccessory ? (
          <div className="pointer-events-auto flex shrink-0 items-center">
            {leadingAccessory}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 sm:gap-3">
        <FeedbackHeaderDialog />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className={chromeSquareIconSegmentClass()}
                >
                  <SignOut weight="duotone" className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </div>
    </header>
  );
}
