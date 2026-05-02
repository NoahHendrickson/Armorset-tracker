/**
 * Extract up to two initials from a Bungie display name like "noey#8868" or
 * "Player Name". Strips the `#NNNN` suffix and falls back to "?" when empty.
 */
export function displayNameInitials(name: string): string {
  const base = name.split("#")[0]?.trim() ?? "";
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}
