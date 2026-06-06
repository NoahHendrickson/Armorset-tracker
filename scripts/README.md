# Scripts

One-off and diagnostic utilities. Most require `.env.local` and `NODE_OPTIONS='--require ./scripts/stub-server-only.cjs'` when importing server-only modules.

| Script | Purpose |
|--------|---------|
| `discover-stat-mod-plugs.ts` | List Bungie manifest plug categories for armor stat mods (+3/+5/+10); used to maintain `STAT_MOD_PLUG_CATEGORY_IDS` in manifest derive. |
| `sync-manifest.ts` | Headless manifest sync (same pipeline as `/api/admin/manifest/sync`). |
| `verify-dim-loadout.ts` | Compare derived stats/bounds against D2ArmorPicker reference builds. |
