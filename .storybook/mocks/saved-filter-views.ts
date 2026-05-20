import type { SavedFilterViewRow } from "@/lib/db/types";
import { MOCK_GRID_FILTERS_POPULATED } from "./grid-filters";

const mockPayload = {
  version: 1 as const,
  setHashes: MOCK_GRID_FILTERS_POPULATED.setHashes,
  archetypeHashes: MOCK_GRID_FILTERS_POPULATED.archetypeHashes,
  tuningHashes: MOCK_GRID_FILTERS_POPULATED.tuningHashes,
  tertiaryStats: MOCK_GRID_FILTERS_POPULATED.tertiaryStats,
};

export const MOCK_SAVED_FILTER_VIEW_OWNED: SavedFilterViewRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  name: "Arc + Health rolls",
  filters: mockPayload,
  view_mode: "grid",
  share_slug: "abc123shareslug",
  source_user_id: null,
  source_display_name: null,
  source_share_slug: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const MOCK_SAVED_FILTER_VIEW_SHARED: SavedFilterViewRow = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "user-1",
  name: "Friend's PvE focus",
  filters: mockPayload,
  view_mode: "table",
  share_slug: null,
  source_user_id: "user-2",
  source_display_name: "FriendGuardian",
  source_share_slug: "friendslug1234",
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};
