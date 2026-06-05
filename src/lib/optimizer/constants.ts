/** Joint slider bands disabled on the hot path (see useStatBoundsForSliders). */
export const JOINT_BOUNDS_COMBO_LIMIT = 0;

/**
 * Max deduped combos for synchronous enumeration on the React render path
 * (slider gray bands, combo-count label). Above this, UI uses greedy estimates only.
 */
export const SYNC_UI_ENUMERATION_COMBO_LIMIT = 2_000;

/** Above this deduped combo count, auto-search is skipped (manual run). */
export const SEARCH_AUTO_RUN_COMBO_LIMIT = 50_000;

/**
 * Max DFS node visits per feasibility probe inside `maxFeasibleStatTarget`.
 * Proves "no match" without scanning the full combinatorial space on large vaults.
 */
export const FEASIBILITY_PROBE_VISIT_CAP = 5_000;

/** Shard the longest armor slot across workers when deduped combos exceed this. */
export const SEARCH_SHARD_MIN_COMBO = 20_000;

/** Minimum pieces in the longest slot before sharding is worthwhile. */
export const SEARCH_SHARD_MIN_SLOT_PIECES = 12;
