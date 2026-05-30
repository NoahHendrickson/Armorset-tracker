/** Shared JSON shape for move/equip API responses (client + route handlers). */
export type InventoryItemActionResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  noop?: boolean;
  partial?: boolean;
  stepsCompleted?: number;
  stepsTotal?: number;
  syncedAt?: string;
  itemCount?: number;
  retryable?: boolean;
  maintenance?: boolean;
  reconnectPath?: string;
};
