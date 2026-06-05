"use client";

import { memo, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptimizerSegmentedControl } from "@/components/optimizer/optimizer-segmented-control";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";
import { LOADOUT_PIECE_COUNT } from "@/lib/plan/constants";
import {
  resolvePlanSelection,
  totalSelectedPieces,
  type PlanArchetypeRow,
  type PlanArchetypeSelection,
} from "@/lib/plan/archetype-bounds";
import {
  defaultTuningNegative,
  formatTuningLabel,
  tuningNegativeOptions,
} from "@/lib/plan/tuning";
import { tertiaryStatsForArchetype } from "@/lib/views/progress";
import { cn } from "@/lib/utils";

const PIECE_COUNTS = [0, 1, 2, 3, 4, 5] as const;

function tuningPairKey(positive: ArmorStatName, negative: ArmorStatName): string {
  return `${positive}:${negative}`;
}

/** Shared across all archetype rows — identical for every pair. */
const ALL_TUNING_PAIR_OPTIONS: ReadonlyArray<{
  positive: ArmorStatName;
  negative: ArmorStatName;
  key: string;
  label: string;
}> = ARMOR_STAT_NAMES.flatMap((positive) =>
  tuningNegativeOptions(positive).map((negative) => ({
    positive,
    negative,
    key: tuningPairKey(positive, negative),
    label: formatTuningLabel(positive, negative),
  })),
);

const thClass =
  "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const tdClass = "px-3 py-3 align-top text-sm";

export type ArchetypeLoadoutPlannerProps = {
  rows: readonly PlanArchetypeRow[];
  selections: Record<string, PlanArchetypeSelection>;
  onSelectionsChange: React.Dispatch<
    React.SetStateAction<Record<string, PlanArchetypeSelection>>
  >;
  statIconByName?: GridLookupPayload["statIconByName"];
};

export function ArchetypeLoadoutPlanner({
  rows,
  selections,
  onSelectionsChange,
  statIconByName = {},
}: ArchetypeLoadoutPlannerProps) {
  const assigned = totalSelectedPieces(selections);
  const remaining = LOADOUT_PIECE_COUNT - assigned;

  const updateRow = useCallback(
    (id: string, patch: Partial<PlanArchetypeSelection>) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      onSelectionsChange((prev) => {
        const current = resolvePlanSelection(row.pair, prev[id]);
        const merged = { ...current, ...patch };
        if (
          patch.tuningPositive != null &&
          patch.tuningNegative == null &&
          merged.tuningNegative === patch.tuningPositive
        ) {
          merged.tuningNegative = defaultTuningNegative(
            merged.tuningPositive,
            merged.tertiary,
          );
        }
        return { ...prev, [id]: merged };
      });
    },
    [rows, onSelectionsChange],
  );

  return (
    <div className="space-y-3">
      <p
        className={cn(
          "text-sm tabular-nums",
          assigned === LOADOUT_PIECE_COUNT
            ? "text-foreground"
            : "text-amber-600 dark:text-amber-400",
        )}
        role="status"
      >
        {assigned} / {LOADOUT_PIECE_COUNT} pieces assigned
        {remaining > 0
          ? ` — assign ${remaining} more`
          : assigned > LOADOUT_PIECE_COUNT
            ? ` — ${assigned - LOADOUT_PIECE_COUNT} over limit`
            : null}
      </p>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={cn(thClass, "min-w-[9rem]")}>Archetype</th>
              <th className={cn(thClass, "min-w-[7.5rem]")}>Tertiary (+20)</th>
              <th className={cn(thClass, "min-w-[11rem]")}>Tuning (±5)</th>
              <th className={cn(thClass, "min-w-[12.5rem]")}>Pieces</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <PlannerRow
                key={row.id}
                row={row}
                statIconByName={statIconByName}
                selection={selections[row.id]}
                updateRow={updateRow}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArchetypeIntrinsicStats({
  pair,
  statIconByName,
}: {
  pair: ArchetypePair;
  statIconByName: GridLookupPayload["statIconByName"];
}) {
  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1 tabular-nums">
        <ArmorStatIcon
          stat={pair.primary}
          iconPath={statIconByName[pair.primary]}
          size="sm"
        />
        <span>30</span>
      </li>
      <li className="flex items-center gap-1 tabular-nums">
        <ArmorStatIcon
          stat={pair.secondary}
          iconPath={statIconByName[pair.secondary]}
          size="sm"
        />
        <span>25</span>
      </li>
    </ul>
  );
}

const PlannerRow = memo(function PlannerRow({
  row,
  statIconByName,
  selection,
  updateRow,
}: {
  row: PlanArchetypeRow;
  statIconByName: GridLookupPayload["statIconByName"];
  selection: PlanArchetypeSelection | undefined;
  updateRow: (id: string, patch: Partial<PlanArchetypeSelection>) => void;
}) {
  const resolved = resolvePlanSelection(row.pair, selection);

  const tertiaryOptions = useMemo(
    () => tertiaryStatsForArchetype(row.pair),
    [row.pair],
  );

  const onTertiaryChange = useCallback(
    (tertiary: ArmorStatName) => updateRow(row.id, { tertiary }),
    [row.id, updateRow],
  );
  const onTuningChange = useCallback(
    (tuningPositive: ArmorStatName, tuningNegative: ArmorStatName) =>
      updateRow(row.id, { tuningPositive, tuningNegative }),
    [row.id, updateRow],
  );
  const onPieceCountChange = useCallback(
    (pieceCount: number) => updateRow(row.id, { pieceCount }),
    [row.id, updateRow],
  );

  const tuningValue = tuningPairKey(
    resolved.tuningPositive,
    resolved.tuningNegative,
  );

  return (
    <tr className={cn(row.isCustom && "bg-amber-500/5")}>
      <td className={tdClass}>
        <p className="font-medium leading-snug">{row.name}</p>
        {row.isCustom ? (
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            Hypothetical
          </p>
        ) : null}
        <ArchetypeIntrinsicStats pair={row.pair} statIconByName={statIconByName} />
      </td>
      <td className={tdClass}>
        <Select
          value={resolved.tertiary}
          onValueChange={(v) => onTertiaryChange(v as ArmorStatName)}
        >
          <SelectTrigger className="h-8 w-full min-w-[6.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tertiaryOptions.map((stat) => (
              <SelectItem key={stat} value={stat}>
                {stat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={tdClass}>
        <Select
          value={tuningValue}
          onValueChange={(key) => {
            const opt = ALL_TUNING_PAIR_OPTIONS.find((o) => o.key === key);
            if (opt) onTuningChange(opt.positive, opt.negative);
          }}
        >
          <SelectTrigger
            className="h-8 w-full min-w-[10rem] text-xs"
            aria-label={`Tuning for ${row.name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {ALL_TUNING_PAIR_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={tdClass}>
        <OptimizerSegmentedControl
          value={resolved.pieceCount}
          options={PIECE_COUNTS}
          onChange={onPieceCountChange}
          ariaLabel={`Piece count for ${row.name}`}
        />
      </td>
    </tr>
  );
});
