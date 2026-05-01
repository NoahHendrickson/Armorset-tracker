/**
 * Quick sanity-check on Supabase manifest tables.
 *   cd spike && npx tsx src/check-db.ts
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("\n=== archetypes table ===");
  const { data: arches } = await sb.from("archetypes").select("*");
  for (const a of arches ?? []) {
    console.log(`  ${a.archetype_hash}\t${a.name}`);
  }
  console.log(`  total: ${arches?.length ?? 0}`);

  console.log("\n=== plug_to_archetype ===");
  const { data: ptArch, count: ptArchCount } = await sb
    .from("plug_to_archetype")
    .select("*", { count: "exact" });
  console.log(`  count: ${ptArchCount}`);
  for (const r of (ptArch ?? []).slice(0, 20)) {
    console.log(`  plug=${r.plug_hash} -> archetype=${r.archetype_hash}`);
  }

  console.log("\n=== tunings table (first 20) ===");
  const { data: tunings, count: tunCount } = await sb
    .from("tunings")
    .select("*", { count: "exact" });
  console.log(`  count: ${tunCount}`);
  for (const t of (tunings ?? []).slice(0, 20)) {
    console.log(`  ${t.tuning_hash}\t${t.name}`);
  }

  console.log("\n=== plug_to_tuning ===");
  const { count: ptTunCount } = await sb
    .from("plug_to_tuning")
    .select("*", { count: "exact", head: true });
  console.log(`  count: ${ptTunCount}`);

  console.log("\n=== armor_sets count ===");
  const { count: setCount } = await sb
    .from("armor_sets")
    .select("*", { count: "exact", head: true });
  console.log(`  count: ${setCount}`);

  console.log("\n=== armor_items count ===");
  const { count: itemsCount } = await sb
    .from("armor_items")
    .select("*", { count: "exact", head: true });
  console.log(`  count: ${itemsCount}`);

  console.log("\n=== sample armor_sets ===");
  const { data: sets } = await sb.from("armor_sets").select("*").limit(20);
  for (const s of sets ?? []) {
    console.log(`  ${s.set_hash}\t${s.name}`);
  }

  // Check that 6 known archetype hashes are in plug_to_archetype
  console.log("\n=== verify 6 known archetype hashes are in plug_to_archetype ===");
  const known = [
    { hash: 549468645, name: "Bulwark" },
    { hash: 1807652646, name: "Gunner" },
    { hash: 2230428468, name: "Specialist" },
    { hash: 2937665788, name: "Grenadier" },
    { hash: 3349393475, name: "Brawler" },
    { hash: 4227065942, name: "Paragon" },
  ];
  for (const k of known) {
    const { data: row } = await sb
      .from("plug_to_archetype")
      .select("*")
      .eq("plug_hash", k.hash)
      .maybeSingle();
    console.log(`  ${k.name} (${k.hash}): ${row ? "FOUND" : "MISSING"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
