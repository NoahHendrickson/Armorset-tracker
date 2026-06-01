"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  countPiecesBySetHash,
  setBonusSelectionConflict,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import type { SetPerkPayload } from "@/lib/views/optimizer-lookup-payload";
import { toSetBonusSelection } from "@/lib/views/optimizer-lookup-payload";
import { cn } from "@/lib/utils";

export type SetBonusPickerProps = {
  pool: DerivedArmorPieceJson[];
  setPerks: SetPerkPayload[];
  selected: SetBonusSelection[];
  onChange: (next: SetBonusSelection[]) => void;
  compact?: boolean;
};

function selectionKey(sel: SetBonusSelection): string {
  return `${sel.setHash}:${sel.perkHash}`;
}

/** Compact switch matching optimizer aria-pressed controls (class / exotic pickers). */
function SetBonusToggle({
  checked,
  disabled,
  ariaLabel,
  compact,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  compact?: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "inline-flex shrink-0 items-center rounded-none border p-0.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "h-4 w-7" : "h-5 w-9",
        checked
          ? "justify-end border-foreground bg-foreground"
          : "justify-start border-border bg-muted hover:border-foreground/50",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "block shrink-0 bg-background",
          compact ? "size-3" : "size-3.5",
        )}
        aria-hidden
      />
    </button>
  );
}

type SetBonusTableRow = {
  setHash: number;
  setName: string;
  piecesInPool: number;
  twoPc: SetPerkPayload[];
  fourPc: SetPerkPayload[];
};

function buildSetBonusRows(
  pool: DerivedArmorPieceJson[],
  setPerks: SetPerkPayload[],
): SetBonusTableRow[] {
  const counts = countPiecesBySetHash(pool);
  const bySet = new Map<number, SetPerkPayload[]>();
  for (const perk of setPerks) {
    const list = bySet.get(perk.setHash) ?? [];
    list.push(perk);
    bySet.set(perk.setHash, list);
  }

  return [...bySet.entries()]
    .map(([setHash, perks]) => ({
      setHash,
      setName: perks[0]?.setName ?? "Set",
      piecesInPool: counts.get(setHash) ?? 0,
      twoPc: perks.filter((p) => p.requiredSetCount === 2),
      fourPc: perks.filter((p) => p.requiredSetCount === 4),
    }))
    .filter(
      (row) =>
        row.piecesInPool > 0 &&
        (row.twoPc.length > 0 || row.fourPc.length > 0),
    )
    .sort((a, b) => a.setName.localeCompare(b.setName));
}

function SetBonusTierCell({
  perks,
  minPieces,
  piecesInPool,
  selectedKeys,
  onToggle,
  compact,
}: {
  perks: SetPerkPayload[];
  minPieces: number;
  piecesInPool: number;
  selectedKeys: Set<string>;
  onToggle: (perk: SetPerkPayload) => void;
  compact?: boolean;
}) {
  if (perks.length === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  const tierAvailable = piecesInPool >= minPieces;

  return (
    <div
      className={cn(
        "flex flex-wrap justify-center gap-2",
        perks.length > 1 ? "gap-x-3" : "",
      )}
    >
      {perks.map((perk) => {
        const sel = toSetBonusSelection(perk);
        const key = selectionKey(sel);
        const checked = selectedKeys.has(key);
        const disabled = !tierAvailable;

        return (
          <Tooltip key={perk.perkHash}>
            <TooltipTrigger asChild>
              <SetBonusToggle
                checked={checked}
                disabled={disabled}
                compact={compact}
                ariaLabel={`${perk.setName} ${minPieces}-piece: ${perk.name}`}
                onCheckedChange={() => onToggle(perk)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <p className="font-medium text-foreground">{perk.name}</p>
              {perk.description ? (
                <p className="mt-1 text-muted-foreground">{perk.description}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function SetBonusPicker({
  pool,
  setPerks,
  selected,
  onChange,
  compact = false,
}: SetBonusPickerProps) {
  const rows = useMemo(
    () => buildSetBonusRows(pool, setPerks),
    [pool, setPerks],
  );
  const selectedKeys = useMemo(
    () => new Set(selected.map(selectionKey)),
    [selected],
  );
  const conflict = setBonusSelectionConflict(selected);

  const toggle = (perk: SetPerkPayload) => {
    const sel = toSetBonusSelection(perk);
    const key = selectionKey(sel);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((s) => selectionKey(s) !== key));
      return;
    }
    onChange([...selected, sel]);
  };

  if (setPerks.length === 0) {
    return (
      <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        Set bonus catalog unavailable until manifest sync completes.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        No armor sets in your Tier&nbsp;5 pool yet. Add pieces from a set to
        enable 2-piece and 4-piece bonuses here.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {conflict ? (
        <p
          role="alert"
          className={cn(
            "text-amber-600 dark:text-amber-500",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {conflict}
        </p>
      ) : null}
      <Table containerClassName="overflow-visible">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead
              className={cn(
                "px-1.5 font-semibold uppercase tracking-wide text-muted-foreground",
                compact
                  ? "h-7 text-[10px]"
                  : "h-8 px-2 text-xs",
                compact ? "w-[46%]" : "w-[40%]",
              )}
            >
              Set
            </TableHead>
            <TableHead
              className={cn(
                "px-1.5 text-center font-semibold uppercase tracking-wide text-muted-foreground",
                compact ? "h-7 w-[27%] text-[10px]" : "h-8 w-[30%] px-2 text-xs",
              )}
            >
              2pc
            </TableHead>
            <TableHead
              className={cn(
                "px-1.5 text-center font-semibold uppercase tracking-wide text-muted-foreground",
                compact ? "h-7 w-[27%] text-[10px]" : "h-8 w-[30%] px-2 text-xs",
              )}
            >
              4pc
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.setHash} className="hover:bg-muted/30">
              <TableCell
                className={cn(
                  "align-middle",
                  compact ? "px-1.5 py-1.5" : "px-2 py-1.5",
                )}
              >
                <span
                  className={cn(
                    "block truncate font-medium text-foreground",
                    compact ? "text-xs" : "text-sm",
                  )}
                  title={row.setName}
                >
                  {row.setName}
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  "align-middle",
                  compact ? "px-1.5 py-1.5" : "px-2 py-1.5",
                )}
              >
                <SetBonusTierCell
                  perks={row.twoPc}
                  minPieces={2}
                  piecesInPool={row.piecesInPool}
                  selectedKeys={selectedKeys}
                  onToggle={toggle}
                  compact={compact}
                />
              </TableCell>
              <TableCell
                className={cn(
                  "align-middle",
                  compact ? "px-1.5 py-1.5" : "px-2 py-1.5",
                )}
              >
                <SetBonusTierCell
                  perks={row.fourPc}
                  minPieces={4}
                  piecesInPool={row.piecesInPool}
                  selectedKeys={selectedKeys}
                  onToggle={toggle}
                  compact={compact}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
