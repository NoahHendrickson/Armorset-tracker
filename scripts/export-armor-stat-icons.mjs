#!/usr/bin/env node
/**
 * Downloads armor 3.0 stat icons from Bungie (paths in Supabase `armor_stat_icons`)
 * and writes one PNG per stat into exports/armor-stat-icons/ (or OUT_DIR).
 *
 * Usage:
 *   node scripts/export-armor-stat-icons.mjs
 *   node scripts/export-armor-stat-icons.mjs /path/to/output
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local or .env.
 */

import { createClient } from "@supabase/supabase-js";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(join(root, ".env.local"));
loadDotEnv(join(root, ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).",
  );
  process.exit(1);
}

function bungieAssetUrl(iconPath) {
  if (iconPath.startsWith("http")) return iconPath;
  return `https://www.bungie.net${iconPath.startsWith("/") ? iconPath : `/${iconPath}`}`;
}

const outDir =
  process.argv[2] || join(root, "exports", "armor-stat-icons");
mkdirSync(outDir, { recursive: true });

const sb = createClient(supabaseUrl, serviceKey);
const { data: rows, error } = await sb
  .from("armor_stat_icons")
  .select("stat, icon_path")
  .order("stat");

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!rows?.length) {
  console.error("No rows in armor_stat_icons — run a manifest sync first.");
  process.exit(1);
}

for (const row of rows) {
  const stat = String(row.stat).trim();
  const relPath = String(row.icon_path).trim();
  const url = bungieAssetUrl(relPath);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`${stat}: HTTP ${res.status} ${url}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const slug = stat.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const pngPath = join(outDir, `${slug}.png`);
  writeFileSync(pngPath, buf);
  console.log("wrote", `${slug}.png`);
}

console.log("\nOutput directory:", outDir);
