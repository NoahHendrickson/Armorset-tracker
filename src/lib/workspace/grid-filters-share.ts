import {
  gridFiltersSchema,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";

/** Query param on `/dashboard` carrying a shared filter payload. */
export const GRID_FILTERS_SHARE_PARAM = "f";

function toBase64Url(bytes: Uint8Array): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): Uint8Array | null {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(b64, "base64"));
    }
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

/** Encode filters for the `f` query param (base64url JSON). */
export function encodeGridFiltersForShare(filters: GridFiltersJson): string {
  const json = JSON.stringify(filters);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

/** Decode `f` param; returns null when missing, corrupt, or invalid schema. */
export function decodeGridFiltersFromShare(
  param: string | null | undefined,
): GridFiltersJson | null {
  if (param == null || param.trim() === "") return null;
  const bytes = fromBase64Url(param.trim());
  if (bytes === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  const result = gridFiltersSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/** Full dashboard URL with encoded filters. */
export function buildDashboardShareUrl(
  origin: string,
  filters: GridFiltersJson,
): string {
  const base = origin.replace(/\/$/, "");
  const encoded = encodeURIComponent(encodeGridFiltersForShare(filters));
  return `${base}/dashboard?${GRID_FILTERS_SHARE_PARAM}=${encoded}`;
}
