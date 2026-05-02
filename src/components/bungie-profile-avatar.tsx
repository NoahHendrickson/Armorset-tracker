"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayNameInitials } from "@/lib/user-display";

const sizeClasses = {
  sm: {
    box: "h-7 w-7 text-xs",
    img: "h-7 w-7",
  },
  lg: {
    box: "h-8 w-8 text-[10px] leading-none",
    img: "h-8 w-8",
  },
} as const;

export function BungieProfileAvatar({
  displayName,
  profilePictureUrl,
  size = "sm",
}: {
  displayName: string;
  /** Absolute https URL to an image on bungie.net */
  profilePictureUrl: string | null | undefined;
  /** `lg` = 32px circle (nav) */
  size?: keyof typeof sizeClasses;
}) {
  const [broken, setBroken] = useState(false);
  const src =
    profilePictureUrl && profilePictureUrl.length > 0 ? profilePictureUrl : null;
  const s = sizeClasses[size];

  if (!src || broken) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-white/10 font-semibold text-white",
          s.box,
        )}
      >
        {displayNameInitials(displayName)}
      </span>
    );
  }

  const dim = size === "lg" ? 32 : 28;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Bungie CDN; fallback on error above
    <img
      src={src}
      alt=""
      width={dim}
      height={dim}
      className={cn("shrink-0 rounded-full object-cover", s.img)}
      onError={() => setBroken(true)}
    />
  );
}
