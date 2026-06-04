import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { ResolvedLoadout } from "@/lib/optimizer/resolve-loadout-totals";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";

/** Per-stat minimum target; array order = priority. min 0 = no target. */
export type StatConstraintRow = {
  stat: ArmorStatName;
  min: number;
};

/** Restrict enumeration to a slice of one slot's deduped representatives (worker shard). */
export type OptimizerSearchShard = {
  slotIndex: number;
  pieceStart: number;
  pieceEnd: number;
};

export type OptimizerRequest = {
  pool: DerivedArmorPieceJson[];
  constraints: StatConstraintRow[];
  /** Fragment (and similar) flat per-stat offset — not assumed armor mods. */
  statOffset?: Partial<Record<ArmorStatName, number>>;
  /** Shared major/minor mod pool assumed across the loadout. */
  assumedStatMods?: AssumedStatMods;
  exoticLock?: ExoticLock;
  setBonusSelections?: SetBonusSelection[];
  pinnedInstanceIds?: string[];
  excludedInstanceIds?: string[];
  topN?: number;
  shard?: OptimizerSearchShard;
};

export type OptimizerBoundsRequest = {
  pool: DerivedArmorPieceJson[];
  statOffset?: Partial<Record<ArmorStatName, number>>;
  assumedStatMods?: AssumedStatMods;
  exoticLock?: ExoticLock;
  constraints?: StatConstraintRow[];
  setBonusSelections?: SetBonusSelection[];
};

export type StatBounds = Record<ArmorStatName, { min: number; max: number }>;

export type OptimizerSlotKey =
  | "helmet"
  | "arms"
  | "chest"
  | "legs"
  | "classItem";

export type OptimizerSolution = {
  slots: Record<OptimizerSlotKey, string>;
  totals: Record<ArmorStatName, number>;
  signature: string;
  /**
   * Per slot, the instance ids that are stat/set/rarity-interchangeable with
   * the chosen piece (always includes the chosen piece itself).
   */
  interchangeable?: Record<OptimizerSlotKey, string[]>;
  /** Verified tuning branches and mod allocation when available. */
  resolved?: ResolvedLoadout;
};

export type WorkerRunMessage = {
  type: "run";
  id: string;
  payload: OptimizerRequest;
};

export type WorkerComputeBoundsMessage = {
  type: "computeBounds";
  id: string;
  payload: OptimizerBoundsRequest;
};

export type WorkerRequest = WorkerRunMessage | WorkerComputeBoundsMessage;

export type WorkerBoundsMessage = {
  type: "bounds";
  id: string;
  bounds: StatBounds;
};

export type WorkerProgressMessage = {
  type: "progress";
  id: string;
  percent: number;
};

export type WorkerResultMessage = {
  type: "result";
  id: string;
  solutions: OptimizerSolution[];
};

export type WorkerErrorMessage = {
  type: "error";
  id: string;
  message: string;
};

export type WorkerResponse =
  | WorkerBoundsMessage
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;
