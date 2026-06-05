"use client";

import { useMemo, useState } from "react";
import { OptimizerSegmentedControl } from "@/components/optimizer/optimizer-segmented-control";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  FRAGMENT_ELEMENT_TABS,
  formatFragmentElementLabel,
  statFragmentsForElement,
  type FragmentElementTab,
} from "@/lib/plan/fragments-by-element";
import type { FragmentPlugPayload } from "@/lib/views/optimizer-lookup-payload";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { bungieIconUrl } from "@/lib/bungie/constants";
import { cn } from "@/lib/utils";

const thClass =
  "px-1.5 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
const tdClass = "px-1.5 py-1 align-middle text-xs";

export type PlanFragmentSelectorProps = {
  lookup: OptimizerLookupPayload;
  selectedFragmentHashes: number[];
  onToggleFragment: (plugHash: number) => void;
  maxFragments?: number;
  statIconByName?: GridLookupPayload["statIconByName"];
  className?: string;
};

export function PlanFragmentSelector({
  lookup,
  selectedFragmentHashes,
  onToggleFragment,
  maxFragments = 5,
  statIconByName = {},
  className,
}: PlanFragmentSelectorProps) {
  const [element, setElement] = useState<FragmentElementTab>("solar");

  const rows = useMemo(
    () => statFragmentsForElement(lookup, element),
    [lookup, element],
  );

  if (lookup.fragmentPlugs.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Fragment catalog unavailable until manifest sync completes.
      </p>
    );
  }

  const atCap = selectedFragmentHashes.length >= maxFragments;

  return (
    <div className={cn("inline-flex w-fit max-w-full flex-col gap-2", className)}>
      <OptimizerSegmentedControl
        value={element}
        options={FRAGMENT_ELEMENT_TABS}
        onChange={setElement}
        ariaLabel="Fragment element"
        formatOption={formatFragmentElementLabel}
        compact={false}
        className="h-7 [&_button]:h-7 [&_button]:min-w-9 [&_button]:px-2.5"
      />

      <div className="inline-block max-w-full overflow-x-auto border border-border">
        <div className="max-h-52 overflow-y-auto menu-scrollbar">
          <table className="border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className={cn(thClass, "w-8")} scope="col">
                  <span className="sr-only">Equipped</span>
                </th>
                <th className={cn(thClass, "w-7")} scope="col">
                  <span className="sr-only">Icon</span>
                </th>
                <th className={cn(thClass, "whitespace-nowrap")} scope="col">
                  Fragment
                </th>
                {ARMOR_STAT_NAMES.map((stat) => (
                  <th
                    key={stat}
                    className={cn(thClass, "w-9 px-1 text-center")}
                    scope="col"
                  >
                    <ArmorStatIcon
                      stat={stat}
                      iconPath={statIconByName[stat]}
                      size="sm"
                      className="mx-auto size-4"
                    />
                    <span className="sr-only">{stat}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + ARMOR_STAT_NAMES.length}
                    className="px-2 py-4 text-center text-xs text-muted-foreground"
                  >
                    No stat fragments for {formatFragmentElementLabel(element)}.
                  </td>
                </tr>
              ) : (
                rows.map((frag) => (
                  <FragmentRow
                    key={frag.plugHash}
                    frag={frag}
                    checked={selectedFragmentHashes.includes(frag.plugHash)}
                    disabled={
                      !selectedFragmentHashes.includes(frag.plugHash) && atCap
                    }
                    onToggle={() => onToggleFragment(frag.plugHash)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedFragmentHashes.length > 0 ? (
        <p className="text-[11px] tabular-nums leading-snug text-muted-foreground">
          {selectedFragmentHashes.length}/{maxFragments} selected
        </p>
      ) : null}
    </div>
  );
}

function FragmentRow({
  frag,
  checked,
  disabled,
  onToggle,
}: {
  frag: FragmentPlugPayload;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const deltaByStat = useMemo(() => {
    const map = new Map<ArmorStatName, number>();
    for (const delta of frag.deltas) {
      map.set(delta.stat, (map.get(delta.stat) ?? 0) + delta.value);
    }
    return map;
  }, [frag.deltas]);

  return (
    <tr
      className={cn(
        "transition-colors",
        checked && "bg-primary/5",
        disabled && !checked && "opacity-50",
      )}
    >
      <td className={tdClass}>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={() => onToggle()}
          aria-label={`Toggle ${frag.name}`}
          className="h-3.5 w-3.5"
        />
      </td>
      <td className={tdClass}>
        {frag.iconPath ? (
          <img
            src={bungieIconUrl(frag.iconPath)}
            alt=""
            className="size-6 shrink-0 rounded-none border border-border bg-muted/30 object-cover"
            width={24}
            height={24}
          />
        ) : (
          <span
            className="inline-block size-6 shrink-0 border border-border bg-muted/30"
            aria-hidden
          />
        )}
      </td>
      <td className={cn(tdClass, "max-w-[12rem] truncate font-medium")}>
        <span title={frag.name}>{frag.name}</span>
      </td>
      {ARMOR_STAT_NAMES.map((stat) => {
        const value = deltaByStat.get(stat);
        return (
          <td key={stat} className={cn(tdClass, "w-9 px-1 text-center")}>
            {value != null && value !== 0 ? (
              <span
                className={cn(
                  "tabular-nums text-[11px] font-semibold",
                  value > 0
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-destructive",
                )}
              >
                {value > 0 ? `+${value}` : value}
              </span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}
