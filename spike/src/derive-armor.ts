import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getMembershipDataForCurrentUser,
  getProfile,
  refreshAccessToken,
} from "./lib/bungie.js";
import {
  loadConfig,
  loadTokens,
  saveTokens,
  TOKENS_PATH,
  tokensExpired,
} from "./lib/config.js";
import {
  collectAllArmorItems,
  DEFAULT_HEURISTICS,
  deriveArmorPiece,
  type DerivedArmorPiece,
} from "./lib/derive.js";
import { syncManifest } from "./lib/manifest.js";

const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 305];

async function main() {
  const config = loadConfig();
  let tokens = loadTokens();
  if (!tokens) {
    console.error(`No tokens at ${TOKENS_PATH}. Run 'npm run oauth' first.`);
    process.exit(1);
  }

  if (tokensExpired(tokens)) {
    console.log("[auth] access token expired — refreshing...");
    const refreshed = await refreshAccessToken(config, tokens.refresh_token);
    tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_in: refreshed.expires_in,
      refresh_expires_in: refreshed.refresh_expires_in,
      membership_id: refreshed.membership_id,
      obtained_at: Date.now(),
    };
    saveTokens(tokens);
  }

  console.log("[auth] resolving membership...");
  const memberships = await getMembershipDataForCurrentUser(config, tokens);
  const primaryId = memberships.primaryMembershipId;
  const primary =
    memberships.destinyMemberships.find((m) => m.membershipId === primaryId) ??
    memberships.destinyMemberships[0];
  if (!primary) {
    console.error("No Destiny memberships found on this account.");
    process.exit(1);
  }
  console.log(
    `[auth] using ${primary.displayName} (membershipType=${primary.membershipType}, id=${primary.membershipId})`,
  );

  const manifest = await syncManifest(config);

  console.log("[profile] fetching...");
  const profile = await getProfile(
    primary.membershipType,
    primary.membershipId,
    PROFILE_COMPONENTS,
    config,
    tokens,
  );

  const armorItems = collectAllArmorItems(profile);
  console.log(`[profile] found ${armorItems.length} armor items across characters + vault`);

  const heuristics = { ...DEFAULT_HEURISTICS };
  const derived: DerivedArmorPiece[] = [];
  for (const { item, location } of armorItems) {
    const d = deriveArmorPiece(item, location, manifest, profile, heuristics);
    if (d) derived.push(d);
  }

  const slotPad = (s: string) => s.padEnd(10);
  const namePad = (s: string | null, n: number) => (s ?? "—").padEnd(n);
  console.log("");
  console.log(
    `${slotPad("slot")} ${namePad("set", 30)} ${namePad("archetype", 14)} ${namePad("tuning", 14)} location  itemInstanceId`,
  );
  console.log("-".repeat(110));
  for (const d of derived) {
    const loc =
      d.location.kind === "vault"
        ? "vault    "
        : `${["?", "Titan", "Hunter", "Warlock"][d.classType ?? 0] ?? "?"}${d.location.kind === "character" && d.location.equipped ? "*" : " "}`.padEnd(9);
    console.log(
      `${slotPad(d.slot)} ${namePad(d.setName, 30)} ${namePad(d.archetypeName, 14)} ${namePad(d.tuningName, 14)} ${loc} ${d.itemInstanceId}`,
    );
  }

  const stats = summarize(derived, heuristics);
  console.log("\n=== Coverage ===");
  console.log(`armor pieces:                ${derived.length}`);
  console.log(`with set name:               ${stats.withSet}`);
  console.log(`with archetype:              ${stats.withArchetype}`);
  console.log(`with tuning:                 ${stats.withTuning}`);
  console.log(`fully derived (set+arch+tn): ${stats.fullyDerived}`);
  console.log(`archetype category hashes:   ${[...heuristics.archetypeCategoryHashes].join(", ") || "(none found — see diagnostics)"}`);
  console.log(`tuning category hashes:      ${[...heuristics.tuningCategoryHashes].join(", ") || "(none found — see diagnostics)"}`);

  const findingsPath = resolve(process.cwd(), "..", "docs", "spike-findings.md");
  writeFile(findingsPath, buildFindings(derived, heuristics, stats));
  console.log(`\n[findings] written to ${findingsPath}`);
}

function summarize(
  derived: DerivedArmorPiece[],
  heuristics: typeof DEFAULT_HEURISTICS,
): {
  withSet: number;
  withArchetype: number;
  withTuning: number;
  fullyDerived: number;
} {
  let withSet = 0;
  let withArchetype = 0;
  let withTuning = 0;
  let fullyDerived = 0;
  for (const d of derived) {
    if (d.setName) withSet++;
    if (d.archetypeName) withArchetype++;
    if (d.tuningName) withTuning++;
    if (d.setName && d.archetypeName && d.tuningName) fullyDerived++;
  }
  return { withSet, withArchetype, withTuning, fullyDerived };
}

function writeFile(path: string, content: string) {
  writeFileSync(path, content);
}

function buildFindings(
  derived: DerivedArmorPiece[],
  heuristics: typeof DEFAULT_HEURISTICS,
  stats: ReturnType<typeof summarize>,
): string {
  const archHashes = [...heuristics.archetypeCategoryHashes];
  const tuneHashes = [...heuristics.tuningCategoryHashes];

  const sample = derived.slice(0, 3);
  const sampleBlock = sample
    .map((d) => `\n- **${d.slot}** \`${d.itemInstanceId}\` (itemHash ${d.itemHash})
  - set: ${d.setName ?? "—"}
  - archetype: ${d.archetypeName ?? "—"} (plugHash ${d.archetypeHash ?? "—"})
  - tuning: ${d.tuningName ?? "—"} (plugHash ${d.tuningHash ?? "—"})
  - sockets:\n${d.diagnostics.map((s) => `    - [${s.socketIndex}] cat=${s.socketCategoryHash} (${s.categoryName ?? "?"}) plug=${s.plugHash} (${s.plugName ?? "?"}) plugCat=${s.plugCategoryIdentifier ?? "?"}`).join("\n")}`)
    .join("\n");

  return `# Spike Findings — Bungie API derivation

_Auto-generated by \`spike/src/derive-armor.ts\`. Do not hand-edit; rerun the script to regenerate._

## Coverage on this account

| Metric | Value |
|---|---|
| Armor pieces inspected | ${derived.length} |
| With set name | ${stats.withSet} |
| With archetype | ${stats.withArchetype} |
| With tuning | ${stats.withTuning} |
| Fully derived | ${stats.fullyDerived} |

## Confirmed socket category hashes

- **Archetype category hashes**: ${archHashes.length ? archHashes.join(", ") : "**NOT FOUND** — heuristic failed, hand-inspect the diagnostics block below to identify which \`socketCategoryHash\` corresponds to archetype on armor 3.0."}
- **Tuning category hashes**: ${tuneHashes.length ? tuneHashes.join(", ") : "**NOT FOUND** — same as above for tuning."}

These hashes are constants the production app will hardcode in \`src/lib/bungie/derivation.ts\` and refresh whenever the manifest version changes.

## Set-name derivation

We attempted to derive set names via \`itemDef.collectibleHash\` → \`DestinyCollectibleDefinition.displayProperties.name\`.

- Pieces with a set name: ${stats.withSet} / ${derived.length}
- ${stats.withSet === derived.length ? "Clean — collectibleHash maps 1:1 for armor 3.0 in this account." : "Gaps detected — some armor 3.0 pieces don't expose a usable collectibleHash. Production needs a fallback (likely a curated \`setName -> collectibleHash[]\` table built from the manifest at sync time)."}

## Sample diagnostics
${sampleBlock || "\n_(no armor sampled)_"}

## Decisions for production

1. **Hash constants** for archetype + tuning categories, captured above, become the source of truth for \`derivation.ts\` until manifest version changes.
2. **Set derivation** uses \`collectibleHash\` ${stats.withSet === derived.length ? "as the primary path" : "as the primary path with a curated fallback table for armor 3.0 sets that lack collectibles"}.
3. **Manifest tables to ship to the server**: \`DestinyInventoryItemDefinition\` (filtered to armor + plugs), \`DestinySocketCategoryDefinition\`, \`DestinySocketTypeDefinition\`, \`DestinyCollectibleDefinition\`, \`DestinyInventoryBucketDefinition\`, \`DestinyClassDefinition\`. Never ship to the client.
4. **Profile components** confirmed: \`100, 102, 200, 201, 205, 300, 305\`.
5. **Armor bucket hashes** (stable, verified):
   - Helmet: \`3448274439\`
   - Arms: \`3551918588\`
   - Chest: \`14239492\`
   - Legs: \`20886954\`
   - Class item: \`1585787867\`

## Open follow-ups

- [ ] If archetype/tuning hashes were not found, hand-pick them from the diagnostics block and add to \`heuristics.archetypeCategoryHashes\` / \`tuningCategoryHashes\` defaults.
- [ ] If set coverage is incomplete, build a manifest-time \`armor_sets\` derived table by grouping items by \`itemTypeAndTierDisplayName\` or by season tag.
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
