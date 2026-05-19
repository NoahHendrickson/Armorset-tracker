"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { FeedbackHeaderDialog } from "@/components/feedback-header-dialog";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { SyncManifestButton } from "@/components/dashboard/sync-manifest-button";
import { BungieProfileAvatar } from "@/components/bungie-profile-avatar";
import { Button } from "@/components/ui/button";
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
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 items-center gap-2 text-left transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <span className="min-w-0 text-sm font-medium tracking-tight text-foreground">
            D2 Tuning Tracker
          </span>
        </Link>
        {leadingAccessory ? (
          <div className="flex shrink-0 items-center">{leadingAccessory}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <FeedbackHeaderDialog />
        <RefreshButton variant="header-large" />
        <SyncManifestButton variant="header-large" />

        <div className="flex min-w-0 max-w-[min(100vw-10rem,20rem)] items-center gap-2 sm:max-w-none sm:gap-2.5">
          <BungieProfileAvatar
            displayName={displayName}
            profilePictureUrl={profilePictureUrl}
            size="lg"
          />
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
        </div>
        <form action="/api/auth/logout" method="POST" className="contents">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="outline"
                size="icon"
                aria-label="Sign out"
              >
                <SignOut weight="duotone" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </form>
      </div>
    </header>
  );
}
