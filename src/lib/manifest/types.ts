export interface DisplayProperties {
  name?: string;
  description?: string;
  icon?: string;
  hasIcon?: boolean;
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
}

export interface ManifestStatDefinition {
  hash: number;
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
  displayProperties?: DisplayProperties;
  category?: number;
  scope?: number;
}

import type { ArmorStatName } from "@/lib/db/types";

export interface DerivedManifestData {
  version: string;
  archetypeCategoryHashes: number[];
  tuningCategoryHashes: number[];
  armorSets: Array<{ set_hash: number; name: string; season_id: number | null }>;
  armorItems: Array<{
    item_hash: number;
    set_hash: number;
    slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
    class_type: number;
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
}
