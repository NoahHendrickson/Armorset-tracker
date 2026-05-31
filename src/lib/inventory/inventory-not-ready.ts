/** Thrown when inventory cannot be loaded or mutated yet (auth, maintenance, etc.). */
export class InventoryNotReady extends Error {
  constructor(reason: string, readonly status: number = 503) {
    super(reason);
    this.name = "InventoryNotReady";
  }
}
