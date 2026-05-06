/**
 * Row `views.name` — auto-generated from selections (no user title). Used by
 * POST /api/views duplicate detection (`name` + build keys).
 */
export function autoTrackerStorageName(
  setName: string,
  archetypeName: string,
  tuningName: string,
  maxLen = 80,
): string {
  const raw = `${setName} / ${archetypeName} / ${tuningName}`;
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(1, maxLen - 1))}…`;
}
