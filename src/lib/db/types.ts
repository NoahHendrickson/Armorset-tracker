export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          bungie_membership_id: string;
          bungie_membership_type: number;
          display_name: string;
          profile_picture_path: string | null;
          created_at: string;
          updated_at: string;
          workspace_camera: Json;
        };
        Insert: {
          id?: string;
          bungie_membership_id: string;
          bungie_membership_type: number;
          display_name: string;
          profile_picture_path?: string | null;
          created_at?: string;
          updated_at?: string;
          workspace_camera?: Json;
        };
        Update: {
          id?: string;
          bungie_membership_id?: string;
          bungie_membership_type?: number;
          display_name?: string;
          profile_picture_path?: string | null;
          created_at?: string;
          updated_at?: string;
          workspace_camera?: Json;
        };
        Relationships: [];
      };
      oauth_tokens: {
        Row: {
          user_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          expires_at: string;
          refresh_expires_at: string;
          refresh_lease_until: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          expires_at: string;
          refresh_expires_at: string;
          refresh_lease_until?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string;
          expires_at?: string;
          refresh_expires_at?: string;
          refresh_lease_until?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          set_hash: number;
          archetype_hash: number;
          tuning_hash: number;
          class_type: number;
          created_at: string;
          updated_at: string;
          layout: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          set_hash: number;
          archetype_hash: number;
          tuning_hash: number;
          class_type: number;
          created_at?: string;
          updated_at?: string;
          layout?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          set_hash?: number;
          archetype_hash?: number;
          tuning_hash?: number;
          class_type?: number;
          created_at?: string;
          updated_at?: string;
          layout?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      inventory_cache: {
        Row: {
          user_id: string;
          items: Json;
          synced_at: string;
        };
        Insert: {
          user_id: string;
          items: Json;
          synced_at?: string;
        };
        Update: {
          user_id?: string;
          items?: Json;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_cache_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      manifest_versions: {
        Row: { version: string; fetched_at: string; is_active: boolean };
        Insert: { version: string; fetched_at?: string; is_active?: boolean };
        Update: { version?: string; fetched_at?: string; is_active?: boolean };
        Relationships: [];
      };
      armor_sets: {
        Row: {
          set_hash: number;
          name: string;
          season_id: number | null;
          legacy_set_hash: number | null;
          legacy_set_hashes: number[] | null;
        };
        Insert: {
          set_hash: number;
          name: string;
          season_id?: number | null;
          legacy_set_hash?: number | null;
          legacy_set_hashes?: number[] | null;
        };
        Update: {
          set_hash?: number;
          name?: string;
          season_id?: number | null;
          legacy_set_hash?: number | null;
          legacy_set_hashes?: number[] | null;
        };
        Relationships: [];
      };
      armor_items: {
        Row: {
          item_hash: number;
          set_hash: number;
          slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
          class_type: number;
          icon_path: string;
        };
        Insert: {
          item_hash: number;
          set_hash: number;
          slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
          class_type: number;
          icon_path?: string;
        };
        Update: {
          item_hash?: number;
          set_hash?: number;
          slot?: "helmet" | "arms" | "chest" | "legs" | "classItem";
          class_type?: number;
          icon_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "armor_items_set_hash_fkey";
            columns: ["set_hash"];
            isOneToOne: false;
            referencedRelation: "armor_sets";
            referencedColumns: ["set_hash"];
          }
        ];
      };
      archetypes: {
        Row: { archetype_hash: number; name: string };
        Insert: { archetype_hash: number; name: string };
        Update: { archetype_hash?: number; name?: string };
        Relationships: [];
      };
      tunings: {
        Row: { tuning_hash: number; name: string };
        Insert: { tuning_hash: number; name: string };
        Update: { tuning_hash?: number; name?: string };
        Relationships: [];
      };
      plug_to_archetype: {
        Row: { plug_hash: number; archetype_hash: number };
        Insert: { plug_hash: number; archetype_hash: number };
        Update: { plug_hash?: number; archetype_hash?: number };
        Relationships: [];
      };
      plug_to_tuning: {
        Row: { plug_hash: number; tuning_hash: number };
        Insert: { plug_hash: number; tuning_hash: number };
        Update: { plug_hash?: number; tuning_hash?: number };
        Relationships: [];
      };
      archetype_stat_pairs: {
        Row: {
          archetype_hash: number;
          primary_stat: ArmorStatName;
          secondary_stat: ArmorStatName;
        };
        Insert: {
          archetype_hash: number;
          primary_stat: ArmorStatName;
          secondary_stat: ArmorStatName;
        };
        Update: {
          archetype_hash?: number;
          primary_stat?: ArmorStatName;
          secondary_stat?: ArmorStatName;
        };
        Relationships: [
          {
            foreignKeyName: "archetype_stat_pairs_archetype_hash_fkey";
            columns: ["archetype_hash"];
            isOneToOne: true;
            referencedRelation: "archetypes";
            referencedColumns: ["archetype_hash"];
          }
        ];
      };
      armor_stat_plugs: {
        Row: { plug_hash: number; stat: ArmorStatName; value: number };
        Insert: { plug_hash: number; stat: ArmorStatName; value: number };
        Update: { plug_hash?: number; stat?: ArmorStatName; value?: number };
        Relationships: [];
      };
      armor_stat_icons: {
        Row: { stat: ArmorStatName; icon_path: string };
        Insert: { stat: ArmorStatName; icon_path: string };
        Update: { stat?: ArmorStatName; icon_path?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Convenience aliases for use in app code
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type UserRow = Tables<"users">;
export type ViewRow = Tables<"views">;
export type OAuthTokensRow = Tables<"oauth_tokens">;
export type InventoryCacheRow = Tables<"inventory_cache">;
export type ManifestVersionRow = Tables<"manifest_versions">;
export type ArmorSetRow = Tables<"armor_sets">;
export type ArmorItemRow = Tables<"armor_items">;
export type ArchetypeRow = Tables<"archetypes">;
export type TuningRow = Tables<"tunings">;
export type ArchetypeStatPairRow = Tables<"archetype_stat_pairs">;
export type ArmorStatPlugRow = Tables<"armor_stat_plugs">;
export type ArmorStatIconRow = Tables<"armor_stat_icons">;

// The 6 Armor 3.0 stats. Stored as strings everywhere because they're a
// closed set and play nicely with JSON-encoded inventory items + UI.
export const ARMOR_STAT_NAMES = [
  "Weapons",
  "Health",
  "Class",
  "Grenade",
  "Melee",
  "Super",
] as const;
export type ArmorStatName = (typeof ARMOR_STAT_NAMES)[number];

export interface DerivedArmorPieceJson {
  itemInstanceId: string;
  itemHash: number;
  /** Relative manifest icon path; prefix with `bungieIconUrl` in the UI. */
  iconPath?: string;
  slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
  classType: number | null;
  setHash: number | null;
  setName: string | null;
  archetypeHash: number | null;
  archetypeName: string | null;
  tuningHash: number | null;
  tuningName: string | null;
  /**
   * True when `tuningHash` was read from a currently-installed plug (committed
   * + locked at masterwork). False when it was inferred from the reusable
   * plug set of an empty tuning socket — the piece is destined for that
   * tuning direction at drop time but the player hasn't slotted it yet, and
   * the choice of which stat to debuff is still open. Optional so older
   * cached inventory rows (pre-310 fetch) parse cleanly until next sync.
   */
  tuningCommitted?: boolean;
  primaryStat: ArmorStatName | null;
  secondaryStat: ArmorStatName | null;
  tertiaryStat: ArmorStatName | null;
  location: ItemLocationJson;
}

export type ItemLocationJson =
  | { kind: "vault" }
  | {
      kind: "character";
      characterId: string;
      classType: number;
      equipped: boolean;
    };
