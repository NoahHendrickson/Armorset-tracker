"use client";

import { bungieIconUrl } from "@/lib/bungie/constants";
import { subclassesForOptimizerClass } from "@/lib/views/optimizer-lookup-payload";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";

export type SubclassFragmentPanelProps = {
  classType: number;
  lookup: OptimizerLookupPayload;
  selectedSubclassKey: string | null;
  onSubclassChange: (key: string | null) => void;
  selectedFragmentHashes: number[];
  onToggleFragment: (plugHash: number) => void;
  maxFragments?: number;
};

export function SubclassFragmentPanel({
  classType,
  lookup,
  selectedSubclassKey,
  onSubclassChange,
  selectedFragmentHashes,
  onToggleFragment,
  maxFragments,
}: SubclassFragmentPanelProps) {
  const subclasses = subclassesForOptimizerClass(lookup, classType);
  const fragments =
    selectedSubclassKey != null
      ? (lookup.fragmentsBySubclass[selectedSubclassKey] ?? [])
      : [];

  if (lookup.fragmentPlugs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Fragment catalog unavailable until manifest sync completes.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Subclass
        <select
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          value={selectedSubclassKey ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onSubclassChange(v.length > 0 ? v : null);
          }}
        >
          <option value="">Choose a subclass…</option>
          {subclasses.map((sub) => (
            <option key={sub.key} value={sub.key}>
              {sub.label}
            </option>
          ))}
        </select>
      </label>

      {selectedSubclassKey == null ? (
        <p className="text-sm text-muted-foreground">
          Pick a subclass to see its fragments.
        </p>
      ) : fragments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fragments cataloged for this subclass yet.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {fragments.map((frag) => {
            const checked = selectedFragmentHashes.includes(frag.plugHash);
            const atCap =
              maxFragments != null &&
              selectedFragmentHashes.length >= maxFragments;
            const disabled = !checked && atCap;
            const deltaLabel = frag.deltas
              .map((d) => `${d.value >= 0 ? "+" : ""}${d.value} ${d.stat}`)
              .join(", ");
            return (
              <li key={frag.plugHash}>
                <label
                  className={`flex items-start gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleFragment(frag.plugHash)}
                  />
                  {frag.iconPath ? (
                    <img
                      src={bungieIconUrl(frag.iconPath)}
                      alt=""
                      className="size-8 shrink-0 rounded"
                    />
                  ) : null}
                  <span>
                    <span className="font-medium text-foreground">
                      {frag.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {deltaLabel}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selectedFragmentHashes.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {maxFragments != null
            ? `${selectedFragmentHashes.length}/${maxFragments} fragments · offset applied to totals and achievable ranges.`
            : "Fragment offset applied to totals and achievable ranges."}
        </p>
      ) : null}
    </div>
  );
}
