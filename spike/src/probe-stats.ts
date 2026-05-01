/**
 * Decode the 3 hidden `armor_stats` plugs on a real piece of Armor 3.0.
 * Goal: identify how the tertiary stat is encoded.
 *
 *   cd spike && npx tsx src/probe-stats.ts
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "node:crypto";

dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ENC_KEY = process.env.APP_TOKEN_ENCRYPTION_KEY ?? "";
const API_KEY = process.env.BUNGIE_API_KEY ?? "";

const ARMOR_BUCKETS = new Set([
  3448274439, 3551918588, 14239492, 20886954, 1585787867,
]);

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
function k() {
  return createHash("sha256").update(ENC_KEY).digest();
}
function decrypt(buf: Buffer) {
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const d = createDecipheriv(ALG, k(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
function unwrap(raw: unknown): Buffer {
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) return Buffer.from(raw.slice(2), "hex");
    return Buffer.from(raw, "base64");
  }
  if (raw && typeof raw === "object" && "data" in (raw as { data: number[] })) {
    return Buffer.from((raw as { data: number[] }).data);
  }
  throw new Error("bytea?");
}

interface ItemDef {
  hash: number;
  displayProperties?: { name?: string; description?: string };
  itemTypeDisplayName?: string;
  plug?: { plugCategoryIdentifier?: string; plugCategoryHash?: number };
  investmentStats?: Array<{ statTypeHash: number; value: number; isConditionallyActive: boolean }>;
}

interface StatDef {
  hash: number;
  displayProperties?: { name?: string; description?: string };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users } = await sb.from("users").select("*").limit(1);
  if (!users?.length) throw new Error("no user");
  const user = users[0];
  const { data: tokRow } = await sb
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tokRow) throw new Error("no tokens");
  const accessToken = decrypt(unwrap(tokRow.access_token_encrypted));

  // Pull the user's profile with stats component
  const profUrl = `https://www.bungie.net/Platform/Destiny2/${user.bungie_membership_type}/Profile/${user.bungie_membership_id}/?components=100,102,200,201,205,300,304,305`;
  const profRes = await fetch(profUrl, {
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const profile = ((await profRes.json()) as { Response: unknown }).Response as {
    profileInventory?: { data?: { items: Array<InvItem> } };
    characterEquipment?: { data?: Record<string, { items: Array<InvItem> }> };
    itemComponents?: {
      sockets?: { data?: Record<string, { sockets: Array<{ plugHash?: number; isEnabled: boolean; isVisible: boolean }> }> };
      stats?: { data?: Record<string, { stats: Record<string, { statHash: number; value: number }> }> };
    };
  };
  type InvItem = { itemHash: number; itemInstanceId?: string; bucketHash: number };

  // Find one equipped armor piece
  let target: { itemHash: number; instanceId: string } | null = null;
  for (const [, ce] of Object.entries(profile.characterEquipment?.data ?? {})) {
    for (const it of ce.items) {
      if (it.itemInstanceId && ARMOR_BUCKETS.has(it.bucketHash)) {
        target = { itemHash: it.itemHash, instanceId: it.itemInstanceId };
        break;
      }
    }
    if (target) break;
  }
  if (!target) throw new Error("no equipped armor found");

  // Manifest slices
  const idxRes = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: { "X-API-Key": API_KEY },
  });
  const idx = ((await idxRes.json()) as { Response: { jsonWorldComponentContentPaths: Record<string, Record<string, string>> } }).Response;
  const itemsRes = await fetch(
    `https://www.bungie.net${idx.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition}`,
  );
  const items = (await itemsRes.json()) as Record<string, ItemDef>;
  const statsRes = await fetch(
    `https://www.bungie.net${idx.jsonWorldComponentContentPaths.en.DestinyStatDefinition}`,
  );
  const stats = (await statsRes.json()) as Record<string, StatDef>;

  const itemDef = items[String(target.itemHash)];
  console.log(`Sample piece: ${itemDef?.displayProperties?.name} (hash ${target.itemHash})`);

  const sockets =
    profile.itemComponents?.sockets?.data?.[target.instanceId]?.sockets ?? [];
  const itemStats =
    profile.itemComponents?.stats?.data?.[target.instanceId]?.stats ?? {};

  console.log("\n=== Computed item stats (live values from itemComponents) ===");
  for (const [hash, s] of Object.entries(itemStats)) {
    const def = stats[hash];
    console.log(`  ${hash}\t${def?.displayProperties?.name ?? "(?)"}\t= ${s.value}`);
  }

  console.log("\n=== Sockets, focusing on the hidden ones ===");
  for (const [i, s] of sockets.entries()) {
    if (!s.plugHash) continue;
    const def = items[String(s.plugHash)];
    const isHidden = !s.isVisible;
    const statBoosts = def?.investmentStats?.filter((x) => x.value > 0) ?? [];
    console.log(
      `  [${i}] plug=${s.plugHash} "${def?.displayProperties?.name ?? "-"}" cat=${def?.plug?.plugCategoryIdentifier ?? "-"} visible=${s.isVisible} enabled=${s.isEnabled}${isHidden ? "  ← HIDDEN" : ""}`,
    );
    if (def?.investmentStats?.length) {
      for (const inv of def.investmentStats) {
        const sd = stats[String(inv.statTypeHash)];
        console.log(
          `      → ${sd?.displayProperties?.name ?? "(?)"}: ${inv.value > 0 ? "+" : ""}${inv.value}`,
        );
      }
    }
    if (def?.displayProperties?.description) {
      console.log(`      desc: ${def.displayProperties.description.replace(/\n/g, " ")}`);
    }
    void statBoosts;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
