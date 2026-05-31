import type { DerivedArmorPieceJson } from "@/lib/db/types";

function pieceDisplayName(piece: DerivedArmorPieceJson): string | null {
  return piece.displayName ?? piece.setName ?? null;
}

/** Split a search box value into lowercase tokens (whitespace-separated). */
export function tokenizeInventorySearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Strip punctuation so "smoke-jumper" and "smokejumper" align. */
export function normalizeInventorySearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Loose match for armor set / display names: normalized substring, then
 * ordered subsequence (typo-tolerant partial typing).
 */
export function looseInventoryNameMatch(
  token: string,
  displayName: string,
): boolean {
  const t = normalizeInventorySearchText(token);
  const n = normalizeInventorySearchText(displayName);
  if (t.length === 0) return true;
  if (n.length === 0) return false;
  if (n.includes(t)) return true;

  let ti = 0;
  for (let ni = 0; ni < n.length && ti < t.length; ni++) {
    if (n[ni] === t[ti]) ti++;
  }
  return ti === t.length;
}

/**
 * Table search: each whitespace token must match the piece display name (set or
 * exotic item name). Tokens combine with OR — "ferro smoke" surfaces both
 * Ferropotent and Smokejumper rows. Other grid filters still AND on top.
 */
export function inventoryPieceMatchesSetSearch(
  piece: DerivedArmorPieceJson,
  tokens: readonly string[],
): boolean {
  if (tokens.length === 0) return true;
  const name = pieceDisplayName(piece);
  if (!name) return false;
  return tokens.some((token) => looseInventoryNameMatch(token, name));
}
