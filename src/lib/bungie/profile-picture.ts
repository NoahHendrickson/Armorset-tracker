import type { MembershipData } from "@/lib/bungie/types";

/** Prefer wide art when present; returns API-relative path or null. */
export function profilePictureRelPathFromMembership(
  membership: MembershipData,
): string | null {
  const wide = membership.bungieNetUser.profilePictureWidePath?.trim();
  const std = membership.bungieNetUser.profilePicturePath?.trim();
  const path = wide && wide.length > 0 ? wide : std && std.length > 0 ? std : "";
  return path.length > 0 ? path : null;
}
