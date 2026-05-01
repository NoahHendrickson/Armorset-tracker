export interface BungieResponse<T> {
  Response: T;
  ErrorCode: number;
  ThrottleSeconds: number;
  ErrorStatus: string;
  Message: string;
  MessageData?: Record<string, unknown>;
}

export interface MembershipData {
  bungieNetUser: { membershipId: string; displayName: string };
  destinyMemberships: Array<{
    membershipId: string;
    membershipType: number;
    displayName: string;
    bungieGlobalDisplayName?: string;
    bungieGlobalDisplayNameCode?: number;
    crossSaveOverride: number;
    applicableMembershipTypes: number[];
    isPublic?: boolean;
  }>;
  primaryMembershipId?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  membership_id: string;
  token_type: string;
}

export interface ItemComponent {
  itemHash: number;
  itemInstanceId?: string;
  quantity: number;
  bucketHash: number;
  location: number;
  transferStatus: number;
  isWrapper?: boolean;
  bindStatus: number;
  state: number;
  versionNumber?: number;
  overrideStyleItemHash?: number;
}

export interface ItemSocketState {
  plugHash?: number;
  isEnabled: boolean;
  isVisible: boolean;
  enableFailIndexes?: number[];
}

/** One entry in `ItemReusablePlugsComponent` — a plug that *can* be slotted. */
export interface ItemReusablePlug {
  plugItemHash: number;
  canInsert: boolean;
  enabled: boolean;
  insertFailIndices?: number[];
  enableFailIndices?: number[];
}

export interface ProfileResponse {
  profile?: {
    data: {
      userInfo: { membershipId: string; membershipType: number; displayName: string };
    };
  };
  characters?: {
    data: Record<string, { characterId: string; classType: number; classHash: number; light: number }>;
  };
  characterInventories?: {
    data: Record<string, { items: ItemComponent[] }>;
  };
  characterEquipment?: {
    data: Record<string, { items: ItemComponent[] }>;
  };
  profileInventory?: { data: { items: ItemComponent[] } };
  itemComponents?: {
    instances?: { data: Record<string, unknown> };
    sockets?: { data: Record<string, { sockets: ItemSocketState[] }> };
    /**
     * Component 310 — per-instance map of socketIndex → list of plugs that
     * could be slotted into that socket. For an uncommitted Armor 3.0 tuning
     * socket the 5 entries here all share the same tuned-stat direction;
     * reading any one gives us the piece's destined tuning even though
     * `sockets[i].plugHash` is empty.
     */
    reusablePlugs?: {
      data: Record<string, { plugs: Record<string, ItemReusablePlug[]> }>;
    };
    stats?: { data: Record<string, { stats: Record<string, { statHash: number; value: number }> }> };
  };
}

export interface DestinyManifestResponse {
  version: string;
  jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
}
