export interface DisplayProperties {
  name?: string;
  description?: string;
  icon?: string;
  hasIcon?: boolean;
  /** Some stats (e.g. armor 3.0) ship the usable art here when `icon` is empty. */
  highResIcon?: string;
}

export interface ManifestInventoryItemDefinition {
  hash: number;
  redacted?: boolean;
  blacklisted?: boolean;
  displayProperties?: DisplayProperties;
  itemTypeDisplayName?: string;
  itemTypeAndTierDisplayName?: string;
  itemCategoryHashes?: number[];
  inventory?: { bucketTypeHash: number; tierType: number };
  collectibleHash?: number;
  classType?: number;
  seasonHash?: number;
  sockets?: {
    socketEntries: Array<{
      socketTypeHash: number;
      singleInitialItemHash?: number;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
      defaultVisible?: boolean;
    }>;
    socketCategories?: Array<{ socketCategoryHash: number; socketIndexes: number[] }>;
  };
  plug?: {
    plugCategoryHash?: number;
    plugCategoryIdentifier?: string;
  };
  investmentStats?: Array<{
    statTypeHash: number;
    value: number;
    isConditionallyActive?: boolean;
  }>;
  /** When set, item participates in `DestinyEquipableItemSetDefinition` (2/4-piece style bonuses). */
  equippingBlock?: {
    equipableItemSetHash?: number;
  };
}

/** Manifest `DestinyEquipableItemSetDefinition` — set perks at 2 / 4 pieces equipped, etc. */
export interface ManifestEquipableItemSetDefinition {
  hash: number;
  redacted?: boolean;
  displayProperties?: DisplayProperties;
  /** Item definition hashes that belong to this set (when omitted or empty, accept any item with matching `equipableItemSetHash`). */
  setItems?: number[];
  setPerks?: unknown[];
}

export interface ManifestStatDefinition {
  hash: number;
  redacted?: boolean;
  displayProperties?: DisplayProperties;
}

export interface ManifestSocketCategoryDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  category?: number;
}

export interface ManifestSocketTypeDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  socketCategoryHash: number;
  plugWhitelist?: Array<{ categoryHash: number; categoryIdentifier?: string }>;
}

export interface ManifestCollectibleDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  itemHash?: number;
  parentNodeHashes?: number[];
}

export interface ManifestInventoryBucketDefinition {
  hash: number;
  redacted?: boolean;
  blacklisted?: boolean;
  displayProperties?: DisplayProperties;
  category?: number;
  scope?: number;
}

import type { ArmorStatName } from "@/lib/db/types";

export interface DerivedManifestData {
  version: string;
  archetypeCategoryHashes: number[];
  tuningCategoryHashes: number[];
  armorSets: Array<{
    set_hash: number;
    name: string;
    season_id: number | null;
    legacy_set_hash: number;
    legacy_set_hashes: number[];
  }>;
  armorItems: Array<{
    item_hash: number;
    set_hash: number;
    slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
    class_type: number;
    icon_path: string;
  }>;
  archetypes: Array<{ archetype_hash: number; name: string }>;
  tunings: Array<{ tuning_hash: number; name: string }>;
  plugToArchetype: Array<{ plug_hash: number; archetype_hash: number }>;
  plugToTuning: Array<{ plug_hash: number; tuning_hash: number }>;
  archetypeStatPairs: Array<{
    archetype_hash: number;
    primary_stat: ArmorStatName;
    secondary_stat: ArmorStatName;
  }>;
  armorStatPlugs: Array<{
    plug_hash: number;
    stat: ArmorStatName;
    value: number;
  }>;
  /** One icon path per armor stat (DestinyStatDefinition.displayProperties.icon). */
  armorStatIcons: Array<{
    stat: ArmorStatName;
    icon_path: string;
  }>;
}
