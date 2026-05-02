import { NextResponse, type NextRequest } from "next/server";
import { syncManifest } from "@/lib/manifest/sync";
import { invalidateManifestLookups } from "@/lib/manifest/lookups";
import { invalidateManifestVersionCheck } from "@/lib/manifest/version-check";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { BungieApiError } from "@/lib/bungie/client";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  try {
    await requireSessionFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await syncManifest({ force });
    invalidateManifestLookups();
    invalidateManifestVersionCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BungieApiError && err.maintenance) {
      return NextResponse.json(
        { error: "Bungie API in maintenance", maintenance: true },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Manifest sync failed" },
      { status: 500 },
    );
  }
}
