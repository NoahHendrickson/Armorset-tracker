# PRD: Armor Set Checklist App

## Status
Draft
**Author:** Noah
**Last updated:** April 30, 2026

## Overview
A web/mobile app that lets Destiny 2 players track armor set completion against the new armor 3.0 system (archetypes + tertiary stats + tuning stats). Users sign in with their Bungie account, define checklist views for specific set configurations (e.g. "Ferropotent, Gunner archetype, Weapon tuning"), and see at a glance which of the five armor pieces they own that match. Replaces the manual spreadsheet workflow many players use today.

## Background & motivation
Destiny 2's armor 3.0 system introduced archetypes and tuning stats, which dramatically expanded the matrix of "valid" rolls per armor set. There's no way to track a target build configuration in-game or in the companion app — players resort to spreadsheets to track which pieces they have for a given archetype/tuning combination. The screenshot referenced shows a representative manual setup: rows for each armor slot, columns for the relevant stats, checkboxes for ownership.

> Assumption: this app is for personal use first, with potential to share publicly later. Treating it as a solo-player tool, not a clan/group tool.

## Goals
- Let users create and save multiple checklist views, each scoped to a specific (armor set × archetype × tuning stat) combination
- Auto-populate ownership state from the Bungie API rather than requiring manual checkbox toggling
- Surface progress at a glance (e.g. "3/5 pieces collected") for each saved view
- Refresh ownership state on demand and on login
- Support cross-device sync — users can sign in from any device and see their saved views

## Non-goals
- Not a build optimizer or DPS calculator — this only tracks ownership, not stat distributions or roll quality
- Not a vendor/loot recommender — does not tell users where to farm specific pieces
- Not a clan/multi-user tool in v1 — single user, single Bungie account
- Not handling weapons, mods, or non-armor inventory in v1

## Users & use cases

**Active endgame player tracking a target build**: I'm chasing a Ferropotent Gunner set with Weapon tuning. I create a view, and the app shows me I'm missing the helmet and class item. I check this between activities to know what to focus on.

**Player tracking multiple builds in parallel**: I have 4–5 build ideas across different classes. I create a view per build and see overall progress on a dashboard.

**Returning player auditing what they have**: I haven't played in months. I sign in, the app pulls my current inventory and vault, and shows my completion state across any views I had saved.

## Requirements

### Functional requirements

**Authentication**
1. Users must be able to sign in with their Bungie.net account via OAuth.
2. The system shall persist the user's auth token securely and refresh it as needed.
3. Users must be able to sign out and revoke the app's access.

**Checklist views**
4. Users must be able to create a new view by selecting: (a) armor set, (b) archetype, (c) tuning stat.
5. Each view shall display the five armor slots (helmet, arms, chest, legs, class item) as rows.
6. Each row shall show the ownership state: owned (✓), not owned (✗), or unknown (—) if the API call hasn't completed.
7. Users must be able to name and rename their views.
8. Users must be able to delete views.
9. Users must be able to view a list of all their saved views with progress indicators (e.g. "3/5").

**Ownership detection**
10. The system shall query the Bungie API to retrieve the user's full armor inventory across all characters and the vault.
11. The system shall match each inventory item against each view's criteria (set + archetype + tuning) and mark slots as owned when a match exists.
12. The system shall refresh inventory data on user login and on manual refresh (pull-to-refresh on mobile, refresh button on web).
13. The system should cache inventory data locally to avoid redundant API calls within a short time window (e.g. 5 minutes).

**Configuration data**
14. The system shall maintain a list of available armor sets, archetypes, and tuning stats sourced from Bungie's manifest.
15. The system shall update its configuration data when the manifest version changes (e.g. after a Destiny patch).

### Non-functional requirements
- **Performance**: Initial inventory load should complete in <5s for a typical account on broadband. Subsequent view rendering should be instant (<100ms) using cached data.
- **Accessibility**: WCAG 2.1 AA. Checkbox states must be conveyed via more than color alone (icons + ARIA labels).
- **Platform**: Responsive web first; mobile-friendly layout. Native apps deferred.
- **Rate limits**: Must respect Bungie API rate limits (currently 250 req/10s per app, 25 req/sec per user). Batch and cache aggressively.
- **Privacy**: Only request the minimum OAuth scopes needed (read inventory). Never write to the user's Destiny account.

## UX / design notes

**Core flows**
- *Onboarding*: Land → Sign in with Bungie → first inventory sync → empty state prompting "Create your first view"
- *Create view*: Modal or full-screen form with three dropdowns (set, archetype, tuning) → save → land on the view itself
- *View list / dashboard*: Cards or rows, each showing view name + progress (3/5) + last refreshed timestamp
- *Single view*: Clean table mirroring the spreadsheet mental model — rows = armor slots, single column showing ownership state for the selected (archetype, tuning) combo. Optional: expand to show *which* stat rolls qualified.

**Edge cases to handle in design**
- Multiple matching pieces in a slot (e.g. user has 3 helmets that match) — show count badge
- Item is currently equipped vs in vault vs on alt character — possibly show location as secondary info
- Manifest update mid-session causing stale dropdown options
- User has zero matching pieces (clean empty state per row, not just unchecked)
- Token expiry mid-session — silent refresh, fall back to re-auth prompt

> Assumption: visual style matches Noah's existing portfolio aesthetic — concise, punchy, craft-forward. Not Bungie-themed.

## Technical notes

- **Bungie API**: Auth via OAuth 2.0 with `ReadDestinyInventoryAndVault` scope. Inventory retrieved via `Destiny2.GetProfile`. App registration required at bungie.net/en/Application. Rate limits apply — caching is mandatory.
- **Manifest dependency**: All set/archetype/tuning definitions come from Bungie's manifest, which versions with each Destiny patch. The app must detect manifest version changes and refresh derived data.
- **Archetype + tuning derivation is the primary technical risk.** These are not flat properties on armor items — they're derived from socket plugs. **Recommended 1–2 day pre-build spike** to validate the derivation logic against a real account before scoping the rest of the build. See `bungie-api-research.md` for detail.
- **Bungie API outages**: weekly maintenance window (Tuesdays) and occasional downtime. App needs a clear "API unavailable" state.

### Stack & libraries
- **UI components**: [shadcn/ui](https://ui.shadcn.com)
- **Styling**: Tailwind CSS
- **Icons**: [Phosphor Icons](https://phosphoricons.com) via `@phosphor-icons/react`, default weight `regular`. Note: replace Lucide imports with Phosphor when copying shadcn components to avoid mixing icon sets.
- **Font**: [Geist](https://vercel.com/font) — Geist Sans for UI, Geist Mono for numeric display.
- **Backend / storage**: [Supabase](https://supabase.com) (Postgres) for user accounts, saved views, and OAuth token storage. Free tier covers expected v1 usage.

For implementation-level API research (endpoints, components, manifest handling, storage approach), see `bungie-api-research.md`.

## Open questions
- [ ] **Framework choice**: Next.js (App Router), Remix, or Vite + React? Affects auth implementation, API route handling, and deployment target.
- [ ] Which armor sets should be supported at launch — all current-era sets, or scope to a curated list of meta sets first?
- [ ] Should views support "any tuning" or "any archetype" wildcards, or always require a fully specified combo?
- [ ] Should the app surface *near misses* (e.g. a piece that matches the set + archetype but has the wrong tuning)?
- [ ] What happens to saved views when an armor set is sunset or removed from the loot pool?
- [ ] Pricing / hosting model — free, freemium, donation? Affects backend choices.


