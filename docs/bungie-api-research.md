# Bungie API Research — Armor Set Checklist App

Companion document to `prd-armor-set-checklist.md`. Captures the implementation-level API research needed to scope and build the app. Treat this as a working reference, not a finalized spec — values flagged "verify during spike" should be confirmed against a real account response before relying on them.

**Last updated:** April 30, 2026

---

## Pre-build spike

Before scoping the build, run a 1–2 day spike to validate the riskiest assumptions.

**Goal:** prove that for a single armor 3.0 piece, we can derive `(set, archetype, tuning)` from raw API data.

**Steps:**
1. Register a dev app at bungie.net/en/Application; get an API key.
2. Run OAuth flow against a real test account; capture an access token.
3. Hit `Destiny2.GetProfile` with the full component set listed below.
4. Pick one armor 3.0 piece from the response.
5. Walk the path: item instance → sockets → plugs → manifest definitions → archetype + tuning + set.
6. Document the exact `socketCategoryHash` values that identify the archetype and tuning sockets.
7. Confirm whether the set ("Ferropotent", etc.) is derivable cleanly from `collectibleHash` or if it requires fuzzier matching.

**Exit criteria:** a working script that takes an item instance ID and returns `(set, archetype, tuning)`. Without this, the rest of the project is speculative.

---

## API surface

- **Base reference**: [Bungie.net API docs](https://bungie-net.github.io/multi/index.html), Destiny 2 namespace.
- **Auth**: OAuth 2.0 authorization code flow. App registration required at bungie.net/en/Application. Register a redirect URL and request the `ReadDestinyInventoryAndVault` scope (minimum needed to read armor inventory). Tokens expire — implement refresh token handling.
- **Headers**: All requests require `X-API-Key` header. Authed requests additionally require `Authorization: Bearer <token>`.
- **Rate limits**: ~250 req/10s per app, 25 req/sec per user. The fan-out risk grows with the user base — design caching to minimize per-user calls.

---

## Inventory retrieval

- **Primary endpoint**: `Destiny2.GetProfile` with components query param.
- **Required components** (at minimum):
  - `Profiles` (100)
  - `ProfileInventories` (102) — the vault
  - `Characters` (200)
  - `CharacterInventories` (201)
  - `CharacterEquipment` (205)
  - `ItemInstances` (300)
  - `ItemPerks` (302)
  - `ItemStats` (304)
  - `ItemSockets` (305)

  > Verify component numbers against current Bungie docs during the spike — these have been stable but should not be relied on from memory.

- A single `GetProfile` call with all needed components returns the full picture across all characters + vault. Avoid per-item calls.
- Armor lives on characters or in the vault, not at the profile root. The query walks all three character inventories plus the profile (vault) inventory.

---

## Archetype + tuning derivation

This is the core technical risk. Armor 3.0 archetype and tuning stat are **not** stored as flat properties on the item.

**Where they live:**
- Each armor instance has sockets, accessible via `itemComponents.sockets.data[itemInstanceId].sockets`.
- Each socket has a `plugHash` pointing to a plug definition in the manifest.
- Archetype is determined by the plug in the *archetype* socket category.
- Tuning stat is determined by the plug in the *tuning* socket category.

**What needs verification:**
- Exact `socketCategoryHash` values for the archetype and tuning categories — confirm by inspecting the manifest's `DestinyInventoryItemDefinition` for an armor 3.0 piece.
- Plug-to-archetype and plug-to-tuning mappings — these come from `DestinyInventoryItemDefinition` entries for the plug items.

**Set derivation** ("Ferropotent", etc.):
- Likely derivable from the item's `collectibleHash` or via a set/season grouping in the manifest.
- This grouping is not always clean — verify during the spike. Some sets share collectibles or have inconsistent metadata.

---

## Manifest handling

- The manifest is the source of truth for all definitions (sets, archetypes, plugs, sockets, stats).
- **Delivery formats**: SQLite database (~100MB+) and per-table JSON. SQLite is more efficient for server-side use; JSON is easier for selective fetches.
- **Don't ship the full manifest to the client.** Store server-side, expose only the slices the frontend needs (set/archetype/tuning dropdown options, plug-to-archetype mappings, etc.).
- Manifest version is exposed via `Destiny2.GetDestinyManifest`. Check version on app startup; re-pull and rebuild derived definitions when it changes (typically each Destiny patch).
- Build a server-side script that rebuilds the "derived" tables (the slices the app actually uses) whenever a new manifest version drops.

---

## Storage approach

- **User accounts, saved views, metadata**: server-side relational DB (Postgres or similar).
- **Inventory cache**: server-side preferred over client-side. Enables cross-device sync and avoids re-hitting Bungie on every device load. Cache TTL ~5 min with a manual refresh override.
- **OAuth tokens**: encrypted at rest. Never expose to the client beyond what the active session requires.
- **Manifest slices**: server-side, versioned alongside the Bungie manifest version.

---

## Other constraints

- **Bungie API outages and maintenance**: weekly maintenance window (Tuesdays) and occasional unscheduled downtime. The app needs a clear "API unavailable" state.
- **Cross-save accounts**: a single Bungie account may have linked PSN/Xbox/Steam profiles. `GetProfile` handles this transparently as long as the call uses the primary membership ID — confirm during spike.
- **Membership type lookup**: before calling `GetProfile`, you typically need to resolve the user's membership ID and platform via `User.GetMembershipDataForCurrentUser`. Account for this extra hop in the auth → first-load flow.

---

## Open questions for implementation

- [ ] Confirm the exact `socketCategoryHash` values for archetype and tuning sockets (spike output).
- [ ] Confirm whether `collectibleHash` reliably identifies the armor set name, or if a manifest-level set grouping is needed.
- [ ] Decide between SQLite manifest ingestion vs. selective JSON fetches for the server-side definition store.
- [ ] Decide caching layer — Redis, in-memory per server, or DB-backed.
- [ ] Decide whether to store the user's full inventory snapshot or just the derived per-view ownership state.
