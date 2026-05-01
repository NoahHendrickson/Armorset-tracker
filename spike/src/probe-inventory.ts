/**
 * Pull the user's full armor inventory (vault + character bags + equipped),
 * cross-reference every piece against our manifest analysis, and report which
 * Ferropotent (or any chosen set) pieces actually live there.
 *
 *   cd spike && SET=Ferropotent npx tsx src/probe-inventory.ts
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
const NEEDLE = (process.env.SET ?? "Ferropotent").toLowerCase();

const ARMOR_BUCKETS = new Set([
  3448274439, 3551918588, 14239492, 20886954, 1585787867,
]);

const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
  3: "Any",
};

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key() {
  return createHash("sha256").update(ENC_KEY).digest();
}
function decrypt(buf: Buffer) {
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const d = createDecipheriv(ALG, key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
function unwrapBytea(raw: unknown): Buffer {
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) return Buffer.from(raw.slice(2), "hex");
    return Buffer.from(raw, "base64");
  }
  if (raw && typeof raw === "object" && "data" in (raw as { data: number[] })) {
    return Buffer.from((raw as { data: number[] }).data);
  }
  throw new Error("unknown bytea");
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: users } = await sb.from("users").select("*").limit(1);
  if (!users?.length) throw new Error("no user");
  const user = users[0];
  console.log(`User: ${user.display_name}`);

  const { data: tokRow } = await sb
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tokRow) throw new Error("no tokens");
  const accessToken = decrypt(unwrapBytea(tokRow.access_token_encrypted));

  const profUrl = `https://www.bungie.net/Platform/Destiny2/${user.bungie_membership_type}/Profile/${user.bungie_membership_id}/?components=100,102,200,201,205,300,305`;
  const profRes = await fetch(profUrl, {
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!profRes.ok) throw new Error(`profile ${profRes.status}`);
  const profileBody = (await profRes.json()) as { Response?: unknown };
  const profile = profileBody.Response as {
    profileInventory?: { data?: { items: Array<InvItem> } };
    characters?: { data?: Record<string, { classType: number }> };
    characterInventories?: { data?: Record<string, { items: Array<InvItem> }> };
    characterEquipment?: { data?: Record<string, { items: Array<InvItem> }> };
  };
  type InvItem = { itemHash: number; itemInstanceId?: string; bucketHash: number };

  // Manifest item lookups
  const idxRes = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: { "X-API-Key": API_KEY },
  });
  const idx = (await idxRes.json()) as {
    Response: { jsonWorldComponentContentPaths: Record<string, Record<string, string>> };
  };
  const itemsRes = await fetch(
    `https://www.bungie.net${idx.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition}`,
  );
  const itemDefs = (await itemsRes.json()) as Record<
    string,
    {
      displayProperties?: { name?: string };
      itemTypeDisplayName?: string;
      classType?: number;
      inventory?: { bucketTypeHash: number };
    }
  >;

  // Pull our DB armor_items so we know what we *think* is in the set
  const { data: dbArmorItems } = await sb.from("armor_items").select("*");
  const ourArmorByHash = new Map<number, { setHash: number; slot: string; classType: number }>();
  for (const r of dbArmorItems ?? []) {
    ourArmorByHash.set(Number(r.item_hash), {
      setHash: Number(r.set_hash),
      slot: r.slot,
      classType: Number(r.class_type),
    });
  }
  console.log(`armor_items rows: ${ourArmorByHash.size}`);

  const { data: dbSets } = await sb.from("armor_sets").select("*");
  const setHashByName = new Map<string, number>();
  for (const r of dbSets ?? []) {
    setHashByName.set(r.name.toLowerCase(), Number(r.set_hash));
  }
  console.log(`armor_sets rows: ${dbSets?.length ?? 0}`);
  const targetSetHash = [...setHashByName.entries()].find(([n]) => n.includes(NEEDLE))?.[1];
  console.log(`Target set "${NEEDLE}" hash: ${targetSetHash ?? "NOT IN armor_sets"}`);

  // Walk all armor pieces and report
  type Piece = {
    itemHash: number;
    instanceId: string;
    bucketHash: number;
    location: string;
    name: string;
    type: string;
    classType: number;
    matchedInOurDb: boolean;
    ourSetHash: number | null;
    nameMatchesNeedle: boolean;
  };

  function record(items: Array<InvItem>, location: string, characters?: Record<string, { classType: number }>) {
    const out: Piece[] = [];
    for (const it of items) {
      if (!it.itemInstanceId) continue;
      if (!ARMOR_BUCKETS.has(it.bucketHash)) continue;
      const def = itemDefs[String(it.itemHash)];
      const our = ourArmorByHash.get(it.itemHash);
      const cls = def?.classType ?? 3;
      out.push({
        itemHash: it.itemHash,
        instanceId: it.itemInstanceId,
        bucketHash: it.bucketHash,
        location,
        name: def?.displayProperties?.name ?? "(?)",
        type: def?.itemTypeDisplayName ?? "",
        classType: cls,
        matchedInOurDb: !!our,
        ourSetHash: our?.setHash ?? null,
        nameMatchesNeedle: (def?.displayProperties?.name ?? "").toLowerCase().includes(NEEDLE),
      });
    }
    return out;
    void characters;
  }

  const all: Piece[] = [];
  all.push(...record(profile.profileInventory?.data?.items ?? [], "vault"));
  for (const [cid, ce] of Object.entries(profile.characterEquipment?.data ?? {})) {
    const cls = profile.characters?.data?.[cid]?.classType;
    all.push(
      ...record(ce.items, `equipped on ${CLASS_NAMES[cls ?? 3]} (${cid.slice(-4)})`),
    );
  }
  for (const [cid, ci] of Object.entries(profile.characterInventories?.data ?? {})) {
    const cls = profile.characters?.data?.[cid]?.classType;
    all.push(
      ...record(ci.items, `bag of ${CLASS_NAMES[cls ?? 3]} (${cid.slice(-4)})`),
    );
  }

  console.log(`\nTotal armor pieces in inventory: ${all.length}`);
  console.log(`  in our armor_items table: ${all.filter((p) => p.matchedInOurDb).length}`);
  console.log(`  NOT in our armor_items table: ${all.filter((p) => !p.matchedInOurDb).length}`);
  console.log(
    `  matching set_hash for "${NEEDLE}": ${all.filter((p) => targetSetHash != null && p.ourSetHash === targetSetHash).length}`,
  );
  console.log(
    `  with name containing "${NEEDLE}": ${all.filter((p) => p.nameMatchesNeedle).length}`,
  );

  // Show every piece whose name contains the needle
  console.log(`\n=== All pieces with "${NEEDLE}" in name ===`);
  for (const p of all.filter((p) => p.nameMatchesNeedle)) {
    console.log(
      `  ${p.itemHash}\t${CLASS_NAMES[p.classType].padEnd(7)}\t${p.location.padEnd(30)}\tinDB=${p.matchedInOurDb}\tsetHash=${p.ourSetHash ?? "-"}\tname="${p.name}"\ttype="${p.type}"`,
    );
  }

  // Find a small sample of pieces NOT in our DB to see what's leaking through
  console.log(`\n=== 10 sample pieces NOT in armor_items ===`);
  const missing = all.filter((p) => !p.matchedInOurDb);
  for (const p of missing.slice(0, 10)) {
    console.log(
      `  ${p.itemHash}\t${CLASS_NAMES[p.classType].padEnd(7)}\tname="${p.name}"\ttype="${p.type}"`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
