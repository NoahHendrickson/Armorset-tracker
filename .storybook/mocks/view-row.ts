import type { ViewRow } from "@/lib/db/types";
import { defaultWorkspaceLayout } from "@/lib/workspace/workspace-schema";
import {
  MOCK_ARCHETYPES,
  MOCK_ARMOR_SETS,
  MOCK_TUNINGS,
} from "./manifest-lookups";

const NOW = "2026-04-12T18:00:00.000Z";

export const MOCK_VIEW_TITAN: ViewRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "00000000-0000-0000-0000-000000000001",
  name: "Iron Will · Bulwark · +Weapons",
  set_hash: MOCK_ARMOR_SETS[0]!.set_hash,
  archetype_hash: MOCK_ARCHETYPES[0]!.archetype_hash,
  tuning_hash: MOCK_TUNINGS[0]!.tuning_hash,
  class_type: 0,
  created_at: NOW,
  updated_at: NOW,
  layout: defaultWorkspaceLayout(),
};

export const MOCK_VIEW_HUNTER: ViewRow = {
  id: "22222222-2222-2222-2222-222222222222",
  user_id: "00000000-0000-0000-0000-000000000001",
  name: "Reverie Dawn · Brawler · +Health",
  set_hash: MOCK_ARMOR_SETS[1]!.set_hash,
  archetype_hash: MOCK_ARCHETYPES[1]!.archetype_hash,
  tuning_hash: MOCK_TUNINGS[1]!.tuning_hash,
  class_type: 1,
  created_at: NOW,
  updated_at: NOW,
  layout: defaultWorkspaceLayout(),
};

export const MOCK_VIEW_WARLOCK: ViewRow = {
  id: "33333333-3333-3333-3333-333333333333",
  user_id: "00000000-0000-0000-0000-000000000001",
  name: "Tundra Pact · Specialist · +Class",
  set_hash: MOCK_ARMOR_SETS[2]!.set_hash,
  archetype_hash: MOCK_ARCHETYPES[2]!.archetype_hash,
  tuning_hash: MOCK_TUNINGS[2]!.tuning_hash,
  class_type: 2,
  created_at: NOW,
  updated_at: NOW,
  layout: defaultWorkspaceLayout(),
};
