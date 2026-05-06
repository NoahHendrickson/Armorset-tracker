/**
 * Trigger a full manifest derive + DB replace (armor_sets → armor_items, etc.).
 * Run: npx tsx --tsconfig tsconfig.json scripts/sync-manifest.ts [--force]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const force =
  typeof process.argv[2] === "string" && process.argv[2] === "--force";

async function main(): Promise<void> {
  const { syncManifest } = await import("../src/lib/manifest/sync");
  const result = await syncManifest({ force });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
