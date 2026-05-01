/**
 * Pull one of the user's actual armor pieces and dump its socket layout, so we
 * can see what plug hashes are equipped on a real Armor 3.0 piece.
 *
 *   cd spike && npx tsx src/probe-user-piece.ts
 *
 * Reads tokens from the running app's Supabase (service role) and decrypts them
 * with APP_TOKEN_ENCRYPTION_KEY — same data path the Next.js app uses.
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createDecipheriv,
  createHash,
} from "node:crypto";

// Load both spike-local and main-app env so we get all the keys
dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ENC_KEY = process.env.APP_TOKEN_ENCRYPTION_KEY ?? "";
const API_KEY = process.env.BUNGIE_API_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY || !ENC_KEY || !API_KEY) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_TOKEN_ENCRYPTION_KEY, BUNGIE_API_KEY.",
  );
  process.exit(1);
}

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  return createHash("sha256").update(ENC_KEY).digest();
}

function decrypt(buf: Buffer): string {
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const d = createDecipheriv(ALG, key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

const ARMOR_BUCKETS = new Set([
  3448274439, 3551918588, 14239492, 20886954, 1585787867,
]);

interface PgBytea { type: string; data: number[] }

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: users, error: userErr } = await sb.from("users").select("*").limit(1);
  if (userErr || !users || users.length === 0) {
    throw new Error(`No user found: ${userErr?.message ?? "empty"}`);
  }
  const user = users[0];
  console.log(`User: ${user.display_name} (membership ${user.bungie_membership_id})`);

  const { data: tokRow, error: tokErr } = await sb
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (tokErr || !tokRow) {
    throw new Error(`No tokens: ${tokErr?.message ?? "missing"}`);
  }

  // Supabase returns bytea as either base64 string or { type, data } depending on the route
  function unwrapBytea(raw: unknown): Buffer {
    if (typeof raw === "string") {
      // PostgREST returns bytea as \x-prefixed hex
      if (raw.startsWith("\\x")) return Buffer.from(raw.slice(2), "hex");
      return Buffer.from(raw, "base64");
    }
    if (raw && typeof raw === "object" && "data" in (raw as PgBytea)) {
      return Buffer.from((raw as PgBytea).data);
    }
    throw new Error(`Unknown bytea shape: ${typeof raw}`);
  }

  const accessToken = decrypt(unwrapBytea(tokRow.access_token_encrypted));
  console.log(`Got access token (len=${accessToken.length}).`);

  const profUrl = `https://www.bungie.net/Platform/Destiny2/${user.bungie_membership_type}/Profile/${user.bungie_membership_id}/?components=100,102,200,201,205,300,305`;
  const profRes = await fetch(profUrl, {
    headers: {
      "X-API-Key": API_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!profRes.ok) {
    console.error(await profRes.text());
    throw new Error(`profile fetch ${profRes.status}`);
  }
  const profileBody = (await profRes.json()) as { Response?: unknown };
  const profile = profileBody.Response as {
    profileInventory?: { data?: { items: Array<{ itemHash: number; itemInstanceId?: string; bucketHash: number }> } };
    characterEquipment?: { data?: Record<string, { items: Array<{ itemHash: number; itemInstanceId?: string; bucketHash: number }> }> };
    itemComponents?: {
      sockets?: {
        data?: Record<
          string,
          {
            sockets: Array<{
              plugHash?: number;
              isEnabled: boolean;
              isVisible: boolean;
            }>;
          }
        >;
      };
    };
  };

  // Collect all armor pieces with itemInstanceId
  const all: Array<{ itemHash: number; itemInstanceId: string; bucketHash: number; loc: string }> = [];
  for (const it of profile.profileInventory?.data?.items ?? []) {
    if (it.itemInstanceId && ARMOR_BUCKETS.has(it.bucketHash)) {
      all.push({ itemHash: it.itemHash, itemInstanceId: it.itemInstanceId, bucketHash: it.bucketHash, loc: "vault" });
    }
  }
  for (const [charId, ce] of Object.entries(profile.characterEquipment?.data ?? {})) {
    for (const it of ce.items) {
      if (it.itemInstanceId && ARMOR_BUCKETS.has(it.bucketHash)) {
        all.push({ itemHash: it.itemHash, itemInstanceId: it.itemInstanceId, bucketHash: it.bucketHash, loc: `equipped on ${charId}` });
      }
    }
  }
  console.log(`Found ${all.length} armor pieces (vault + equipped).`);

  // Fetch the manifest item definitions to look up plug names
  const idxRes = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: { "X-API-Key": API_KEY },
  });
  const idx = (await idxRes.json()) as {
    Response: { jsonWorldComponentContentPaths: Record<string, Record<string, string>> };
  };
  const itemsPath = idx.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition;
  console.log("Loading manifest items definitions...");
  const itemDefsRes = await fetch(`https://www.bungie.net${itemsPath}`);
  const itemDefs = (await itemDefsRes.json()) as Record<
    string,
    {
      displayProperties?: { name?: string };
      plug?: { plugCategoryIdentifier?: string };
    }
  >;
  console.log(`Loaded ${Object.keys(itemDefs).length} item defs.`);

  // For each armor piece, look at its sockets and find ones whose plug is one of the 6 archetype plugs
  const ARCHETYPE_HASHES = new Set<number>([
    549468645, 1807652646, 2230428468, 2937665788, 3349393475, 4227065942,
  ]);

  let archVisible = 0;
  let archInvisible = 0;
  let archEnabled = 0;
  let archDisabled = 0;
  let withoutArchPlug = 0;
  let printedSamples = 0;

  for (const piece of all) {
    const sockets = profile.itemComponents?.sockets?.data?.[piece.itemInstanceId]?.sockets ?? [];
    if (sockets.length === 0) continue;
    const archSocketIdx = sockets.findIndex(
      (s) => s.plugHash && ARCHETYPE_HASHES.has(s.plugHash),
    );

    if (archSocketIdx === -1) {
      withoutArchPlug++;
      continue;
    }

    const arch = sockets[archSocketIdx];
    if (arch.isVisible) archVisible++;
    else archInvisible++;
    if (arch.isEnabled) archEnabled++;
    else archDisabled++;

    if (printedSamples < 2) {
      const itemName = itemDefs[String(piece.itemHash)]?.displayProperties?.name ?? "(?)";
      const archName = itemDefs[String(arch.plugHash)]?.displayProperties?.name ?? "(?)";
      console.log(
        `\n  ${itemName} (hash ${piece.itemHash}, ${piece.loc}):\n    archetype socket [${archSocketIdx}] plug=${arch.plugHash} name="${archName}" isVisible=${arch.isVisible} isEnabled=${arch.isEnabled}`,
      );
      // Also dump every socket
      for (const [i, s] of sockets.entries()) {
        const def = s.plugHash ? itemDefs[String(s.plugHash)] : undefined;
        console.log(
          `      [${i}] plug=${s.plugHash ?? "-"} "${def?.displayProperties?.name ?? "-"}" cat=${def?.plug?.plugCategoryIdentifier ?? "-"} visible=${s.isVisible} enabled=${s.isEnabled}`,
        );
      }
      printedSamples++;
    }
  }

  console.log(`\n\nSummary across ${all.length} sampled pieces:`);
  console.log(`  ${withoutArchPlug} have no archetype plug (probably not Armor 3.0)`);
  console.log(`  archetype socket isVisible: true=${archVisible}, false=${archInvisible}`);
  console.log(`  archetype socket isEnabled: true=${archEnabled}, false=${archDisabled}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
