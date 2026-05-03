import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";
import {
  parseWorkspaceLayout,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";

/** How trackers are ordered before placement (merge pairs stay atomic). */
export type ArrangeSortMode =
  | "canvas_order"
  | "recent"
  | "oldest"
  | "armor_set"
  | "class_name"
  | "archetype"
  | "tuning";

/** Cluster trackers with the same grouped label into adjacent grid slots. */
export type ArrangeGroupMode =
  | "none"
  | "armor_set"
  | "class_name"
  | "archetype"
  | "tuning";

export interface ArrangeGridComputation {
  updates: { id: string; layout: WorkspaceLayoutJson }[];
}

const COLS = 5;
const GAP = 40;

/** When clustering by class, inner grid is two columns (`2 × n` merge-groups). */
const CLASS_CLUSTER_INNER_COLS = 2;
/**
 * Gap between distinct top-level clusters / primary pillars (in addition to
 * the normal `GAP` inside a `2 × n` grid).
 */
const CLASS_CLUSTER_OUTER_GAP = 200;

/** Vertical gap between secondary stacks inside one primary pillar. */
const SUBCLUSTER_VERTICAL_GAP = 160;

function innerGridWidthPx(): number {
  return CLASS_CLUSTER_INNER_COLS * (TRACKER_WIDTH + GAP) - GAP;
}

function innerGridHeightForGroupCount(groupsInLeaf: number, slotH: number): number {
  const rows = Math.ceil(groupsInLeaf / CLASS_CLUSTER_INNER_COLS);
  return rows * slotH - GAP;
}

/**
 * Packing row width for laying out pillar-sized blocks side-by-side before
 * wrapping to the next stripe.
 */
function clusterPackMaxWidthPx(): number {
  return Math.min(3200, WORKSPACE_CANVAS_WIDTH - 400);
}

function placeGroupsInSlots(
  groups: readonly string[][],
  startX: number,
  startY: number,
  cols: number,
  slotW: number,
  slotH: number,
  idToPayload: Map<string, SerializableTrackerPayload>,
  updates: { id: string; layout: WorkspaceLayoutJson }[],
): void {
  groups.forEach((g, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * slotW;
    const y = startY + row * slotH;
    for (const id of g) {
      const tracker = idToPayload.get(id);
      if (!tracker) continue;
      const lo = parseWorkspaceLayout(tracker.view.layout);
      updates.push({ id, layout: { ...lo, x, y } });
    }
  });
}

function computeClassClusterLayouts(
  orderedBuckets: readonly string[][][],
  idToPayload: Map<string, SerializableTrackerPayload>,
): ArrangeGridComputation {
  const SLOT_W = TRACKER_WIDTH + GAP;
  const SLOT_H = TRACKER_DEFAULT_HEIGHT + GAP;

  /** merge-group rectangles (canvas px) excluding outer gap */
  interface PlacedBucket {
    offsetX: number;
    offsetY: number;
    groups: string[][];
    innerW: number;
    innerH: number;
  }

  const packMaxW = clusterPackMaxWidthPx();
  let rowX = 0;
  let rowY = 0;
  let rowStripeHeight = 0;
  let packMaxRight = 0;
  let packMaxBottom = 0;
  const placed: PlacedBucket[] = [];

  for (const bucketGroups of orderedBuckets) {
    if (bucketGroups.length === 0) continue;
    const n = bucketGroups.length;
    const innerRows = Math.ceil(n / CLASS_CLUSTER_INNER_COLS);
    const innerW =
      CLASS_CLUSTER_INNER_COLS * SLOT_W - GAP;
    const innerH = innerRows * SLOT_H - GAP;

    if (rowX + innerW > packMaxW && rowX > 0) {
      rowY += rowStripeHeight + CLASS_CLUSTER_OUTER_GAP;
      rowX = 0;
      rowStripeHeight = 0;
    }

    placed.push({
      offsetX: rowX,
      offsetY: rowY,
      groups: [...bucketGroups],
      innerW,
      innerH,
    });

    packMaxRight = Math.max(packMaxRight, rowX + innerW);
    packMaxBottom = Math.max(packMaxBottom, rowY + innerH);

    rowX += innerW + CLASS_CLUSTER_OUTER_GAP;
    rowStripeHeight = Math.max(rowStripeHeight, innerH);
  }

  const packedW = packMaxRight;
  const packedH = packMaxBottom;
  const canvasOffsetX =
    WORKSPACE_CANVAS_WIDTH / 2 - packedW / 2;
  const canvasOffsetY =
    WORKSPACE_CANVAS_HEIGHT / 2 - packedH / 2;

  const updates: { id: string; layout: WorkspaceLayoutJson }[] = [];
  for (const bucket of placed) {
    placeGroupsInSlots(
      bucket.groups,
      canvasOffsetX + bucket.offsetX,
      canvasOffsetY + bucket.offsetY,
      CLASS_CLUSTER_INNER_COLS,
      SLOT_W,
      SLOT_H,
      idToPayload,
      updates,
    );
  }

  return { updates };
}

function groupingLabel(
  p: SerializableTrackerPayload,
  mode: ArrangeGroupMode,
): string {
  switch (mode) {
    case "none":
      return "_";
    case "armor_set":
      return p.setName || "";
    case "class_name":
      return p.className || "";
    case "archetype":
      return p.archetypeName || "";
    case "tuning":
      return p.tuningName || "";
    default:
      return "_";
  }
}

function mergedGroupBucketKey(
  ids: readonly string[],
  payloads: Map<string, SerializableTrackerPayload>,
  groupBy: ArrangeGroupMode,
): string {
  if (groupBy === "none") return "_";
  const labels = [...new Set(ids.map((id) => groupingLabel(payloads.get(id)!, groupBy)))];
  labels.sort((a, b) => a.localeCompare(b));
  return labels.join(" | ") || "__empty";
}

/**
 * Lowest index among class labels appearing in key (merged keys join with `|`).
 */
function destinyClassPreferenceIndex(
  mergedBucketLabel: string,
  preferredLeftToRight: readonly string[],
): number {
  if (preferredLeftToRight.length === 0)
    return Number.POSITIVE_INFINITY;
  const indexByLabel = new Map(
    preferredLeftToRight.map((label, idx) => [label, idx] as const),
  );
  const parts = mergedBucketLabel
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  let best = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    const i = indexByLabel.get(part);
    if (i !== undefined && i < best) best = i;
  }
  return best;
}

/** Sort primary bucket labels; uses class column order only when clustering by class label. */
function comparePrimaryMergeBucketKeys(
  a: string,
  b: string,
  preferredClassColumnOrder?: readonly string[] | null,
): number {
  if (preferredClassColumnOrder && preferredClassColumnOrder.length > 0) {
    const sentinel = preferredClassColumnOrder.length + 10;
    const ia = destinyClassPreferenceIndex(a, preferredClassColumnOrder);
    const ib = destinyClassPreferenceIndex(b, preferredClassColumnOrder);
    const fa = ia === Number.POSITIVE_INFINITY ? sentinel : ia;
    const fb = ib === Number.POSITIVE_INFINITY ? sentinel : ib;
    if (fa !== fb) return fa - fb;
  }
  return a.localeCompare(b);
}

function compareMergedGroups(
  idsA: readonly string[],
  idsB: readonly string[],
  sort: ArrangeSortMode,
  idToPayload: Map<string, SerializableTrackerPayload>,
  listIndex: Map<string, number>,
): number {
  const pay = (ids: readonly string[]) =>
    ids.map((id) => idToPayload.get(id)!);

  switch (sort) {
    case "canvas_order": {
      const ia = Math.min(...idsA.map((id) => listIndex.get(id)!));
      const ib = Math.min(...idsB.map((id) => listIndex.get(id)!));
      return ia - ib;
    }
    case "recent": {
      const maxT = (ids: readonly string[]) =>
        Math.max(
          ...pay(ids).map((p) =>
            Date.parse(String(p.view.created_at)),
          ),
        );
      return maxT(idsB) - maxT(idsA);
    }
    case "oldest": {
      const minT = (ids: readonly string[]) =>
        Math.min(
          ...pay(ids).map((p) =>
            Date.parse(String(p.view.created_at)),
          ),
        );
      return minT(idsA) - minT(idsB);
    }
    case "armor_set": {
      const line = (p: SerializableTrackerPayload) =>
        [p.setName, p.archetypeName, p.tuningName, p.view.name].join("\0");
      const minLex = (ids: readonly string[]) =>
        [...pay(ids).map(line)].sort((a, b) => a.localeCompare(b))[0]!;
      return minLex(idsA).localeCompare(minLex(idsB));
    }
    case "class_name": {
      const line = (p: SerializableTrackerPayload) =>
        [
          p.className || "",
          p.setName,
          p.archetypeName,
          p.tuningName,
          p.view.name,
        ].join("\0");
      const minLex = (ids: readonly string[]) =>
        [...pay(ids).map(line)].sort((a, b) => a.localeCompare(b))[0]!;
      return minLex(idsA).localeCompare(minLex(idsB));
    }
    case "archetype": {
      const line = (p: SerializableTrackerPayload) =>
        [p.archetypeName, p.setName, p.tuningName, p.view.name].join("\0");
      const minLex = (ids: readonly string[]) =>
        [...pay(ids).map(line)].sort((a, b) => a.localeCompare(b))[0]!;
      return minLex(idsA).localeCompare(minLex(idsB));
    }
    case "tuning": {
      const line = (p: SerializableTrackerPayload) =>
        [p.tuningName, p.setName, p.archetypeName, p.view.name].join("\0");
      const minLex = (ids: readonly string[]) =>
        [...pay(ids).map(line)].sort((a, b) => a.localeCompare(b))[0]!;
      return minLex(idsA).localeCompare(minLex(idsB));
    }
    default:
      return 0;
  }
}

interface PillarWithStacksDesc {
  /** Sorted merge-groups inside one secondary leaf (`2 × n`). */
  readonly stacks: readonly { readonly groups: readonly string[][] }[];
}

/** Primary pillars left-to-right (wrapping); within each pillar, secondary stacks top-to-bottom. */
function computeNestedPrimarySecondaryLayouts(
  mergeGroups: readonly string[][],
  primary: ArrangeGroupMode,
  secondary: ArrangeGroupMode,
  sort: ArrangeSortMode,
  idToPayload: Map<string, SerializableTrackerPayload>,
  listIndex: Map<string, number>,
  primaryClassColumnOrder?: readonly string[] | null,
): ArrangeGridComputation {
  const tree = new Map<string, Map<string, string[][]>>();
  for (const g of mergeGroups) {
    const pk = mergedGroupBucketKey(g, idToPayload, primary);
    const sk = mergedGroupBucketKey(g, idToPayload, secondary);
    if (!tree.has(pk)) tree.set(pk, new Map());
    const sub = tree.get(pk)!;
    if (!sub.has(sk)) sub.set(sk, []);
    sub.get(sk)!.push(g);
  }

  const prefOrder =
    primary === "class_name" ? primaryClassColumnOrder : null;
  const primaryKeys = [...tree.keys()].sort((a, b) =>
    comparePrimaryMergeBucketKeys(a, b, prefOrder),
  );
  const pillars: PillarWithStacksDesc[] = primaryKeys.map((pk) => {
    const sub = tree.get(pk)!;
    const secKeys = [...sub.keys()].sort((a, b) => a.localeCompare(b));
    const stacks = secKeys.map((sk) => ({
      groups: [...sub.get(sk)!].sort((gA, gB) =>
        compareMergedGroups(gA, gB, sort, idToPayload, listIndex),
      ),
    }));
    return { stacks };
  });

  const SLOT_W = TRACKER_WIDTH + GAP;
  const SLOT_H = TRACKER_DEFAULT_HEIGHT + GAP;
  const pillarW = innerGridWidthPx();
  const packMaxW = clusterPackMaxWidthPx();

  let rowX = 0;
  let rowY = 0;
  let rowStripeHeight = 0;
  let packMaxRight = 0;
  let packMaxBottom = 0;

  const updates: { id: string; layout: WorkspaceLayoutJson }[] = [];

  for (const pillar of pillars) {
    let pillarH = 0;
    for (let i = 0; i < pillar.stacks.length; i++) {
      const n = pillar.stacks[i].groups.length;
      pillarH += innerGridHeightForGroupCount(n, SLOT_H);
      if (i < pillar.stacks.length - 1) pillarH += SUBCLUSTER_VERTICAL_GAP;
    }

    if (rowX + pillarW > packMaxW && rowX > 0) {
      rowY += rowStripeHeight + CLASS_CLUSTER_OUTER_GAP;
      rowX = 0;
      rowStripeHeight = 0;
    }

    let localY = 0;
    for (let i = 0; i < pillar.stacks.length; i++) {
      const stack = pillar.stacks[i];
      const innerH = innerGridHeightForGroupCount(stack.groups.length, SLOT_H);
      placeGroupsInSlots(
        stack.groups,
        rowX,
        rowY + localY,
        CLASS_CLUSTER_INNER_COLS,
        SLOT_W,
        SLOT_H,
        idToPayload,
        updates,
      );
      localY += innerH + (i < pillar.stacks.length - 1 ? SUBCLUSTER_VERTICAL_GAP : 0);
    }

    packMaxRight = Math.max(packMaxRight, rowX + pillarW);
    packMaxBottom = Math.max(packMaxBottom, rowY + pillarH);

    rowX += pillarW + CLASS_CLUSTER_OUTER_GAP;
    rowStripeHeight = Math.max(rowStripeHeight, pillarH);
  }

  const packedW = packMaxRight;
  const packedH = packMaxBottom;
  const canvasOffsetX = WORKSPACE_CANVAS_WIDTH / 2 - packedW / 2;
  const canvasOffsetY = WORKSPACE_CANVAS_HEIGHT / 2 - packedH / 2;

  for (const u of updates) {
    u.layout = {
      ...u.layout,
      x: u.layout.x + canvasOffsetX,
      y: u.layout.y + canvasOffsetY,
    };
  }

  return { updates };
}

/**
 * Computes new canvas positions so each merge-aware group occupies one grid cell
 * on a centered 5-column layout inside the nominal workspace rectangle.
 */
export function computeWorkspaceGridLayouts(
  list: readonly SerializableTrackerPayload[],
  options: {
    sort: ArrangeSortMode;
    groupBy: ArrangeGroupMode;
    /** When set with a primary cluster, subdivides each primary pillar vertically. */
    groupBySecondary?: ArrangeGroupMode | null;
    /** Left-to-right order for Destiny class pillar labels (`Titan`, `Hunter`, `Warlock`). */
    classColumnOrder?: readonly string[] | null;
  },
): ArrangeGridComputation {
  const idToPayload = new Map(list.map((t): [string, SerializableTrackerPayload] => [t.view.id, t]));
  const listIndex = new Map(list.map((t, i): [string, number] => [t.view.id, i]));
  const groupBySecondary = options.groupBySecondary ?? null;

  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const t of list) {
    if (visited.has(t.view.id)) continue;
    const partnerId = t.view.layout.mergedWith ?? null;
    if (partnerId && list.some((p) => p.view.id === partnerId)) {
      groups.push([t.view.id, partnerId]);
      visited.add(t.view.id);
      visited.add(partnerId);
    } else {
      groups.push([t.view.id]);
      visited.add(t.view.id);
    }
  }

  if (
    options.groupBy !== "none" &&
    groupBySecondary !== null &&
    groupBySecondary !== "none" &&
    groupBySecondary !== options.groupBy
  ) {
    return computeNestedPrimarySecondaryLayouts(
      groups,
      options.groupBy,
      groupBySecondary,
      options.sort,
      idToPayload,
      listIndex,
      options.classColumnOrder ?? null,
    );
  }

  const buckets = new Map<string, string[][]>();
  for (const g of groups) {
    const key = mergedGroupBucketKey(g, idToPayload, options.groupBy);
    const cur = buckets.get(key);
    if (cur) cur.push(g);
    else buckets.set(key, [g]);
  }

  const classOrderPref =
    options.groupBy === "class_name" ? options.classColumnOrder : null;
  const bucketKeys = [...buckets.keys()].sort((a, b) =>
    comparePrimaryMergeBucketKeys(a, b, classOrderPref),
  );
  const orderedBuckets: string[][][] = [];
  for (const bk of bucketKeys) {
    const inner = buckets.get(bk)!;
    const sortedInner = [...inner].sort((gA, gB) =>
      compareMergedGroups(gA, gB, options.sort, idToPayload, listIndex),
    );
    orderedBuckets.push(sortedInner);
  }

  if (options.groupBy === "class_name") {
    return computeClassClusterLayouts(orderedBuckets, idToPayload);
  }

  const orderedGroups = orderedBuckets.flat();
  const SLOT_W = TRACKER_WIDTH + GAP;
  const SLOT_H = TRACKER_DEFAULT_HEIGHT + GAP;
  const rows = Math.ceil(orderedGroups.length / COLS);
  const gridW = Math.min(orderedGroups.length, COLS) * SLOT_W - GAP;
  const gridH = rows * SLOT_H - GAP;
  const startX = WORKSPACE_CANVAS_WIDTH / 2 - gridW / 2;
  const startY = WORKSPACE_CANVAS_HEIGHT / 2 - gridH / 2;

  const updates: { id: string; layout: WorkspaceLayoutJson }[] = [];
  orderedGroups.forEach((g, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = startX + col * SLOT_W;
    const y = startY + row * SLOT_H;
    for (const id of g) {
      const tracker = idToPayload.get(id);
      if (!tracker) continue;
      const lo = parseWorkspaceLayout(tracker.view.layout);
      updates.push({ id, layout: { ...lo, x, y } });
    }
  });

  return { updates };
}
