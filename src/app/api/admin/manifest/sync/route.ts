import { NextResponse, type NextRequest } from "next/server";
import { syncManifest } from "@/lib/manifest/sync";
import { invalidateManifestLookups } from "@/lib/manifest/lookups";
import { invalidateManifestVersionCheck } from "@/lib/manifest/version-check";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { BungieApiError } from "@/lib/bungie/client";
import { serverEnv } from "@/lib/env";

export const maxDuration = 300;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handleManifestSync(force: boolean) {
  const result = await syncManifest({ force });
  invalidateManifestLookups();
  invalidateManifestVersionCheck();
  return NextResponse.json({ ok: true, ...result });
}

function manifestSyncErrorResponse(err: unknown) {
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

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await handleManifestSync(false);
  } catch (err) {
    return manifestSyncErrorResponse(err);
  }
}

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
    return await handleManifestSync(force);
  } catch (err) {
    return manifestSyncErrorResponse(err);
  }
}
