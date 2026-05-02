import {
  CLASS_NAMES,
  SLOT_LABELS,
  SLOT_ORDER,
  bungieIconUrl,
} from "@/lib/bungie/constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import { OwnershipIcon, type OwnershipState } from "./ownership-icon";

interface ViewGridProps {
  progress: ViewProgress;
  hasInventory: boolean;
  /** Relative manifest icon paths keyed by tertiary stat name. */
  tertiaryStatIconPaths?: Partial<Record<ArmorStatName, string>>;
}

function matchSummary(match: DerivedArmorPieceJson): string {
  const locationLabel =
    match.location.kind === "vault"
      ? "Vault"
      : `${CLASS_NAMES[match.location.classType] ?? "Unknown"}${
          match.location.equipped ? " (equipped)" : ""
        }`;
  // Show tuning state explicitly. `tuningCommitted === false` means the piece
  // is destined for this tuning direction (read from the socket's reusable
  // plug set) but no plug is slotted yet — at masterwork the player still
  // has to install one of the 5 "+stat / -stat" variants. We don't strictly
  // need to surface the destined-vs-locked distinction for matching to be
  // correct (both count as a match for the view's tuning), but it's useful
  // when comparing duplicate rolls.
  const tuningLabel =
    match.tuningHash === null
      ? "tuning: unknown"
      : `tuning: ${match.tuningName ?? "unknown"}${
          match.tuningCommitted === false ? " (uncommitted)" : ""
        }`;
  return `${locationLabel} · ${tuningLabel}`;
}

function cellTitle(
  state: OwnershipState,
  matches: DerivedArmorPieceJson[],
): string {
  if (state === "loading") return "Loading inventory…";
  if (state === "missing") return "0 matching pieces";
  if (matches.length === 1) return `Owned — ${matchSummary(matches[0])}`;
  return `Owned (${matches.length})\n${matches.map((m) => `• ${matchSummary(m)}`).join("\n")}`;
}

/**
 * Tracker body grid — implements the Figma "tertiary × slot" table:
 *   120px slot column + one 100px column per tertiary stat, 48px rows.
 *   Header row is muted; body rows are white medium weight with a subtle
 *   bottom border between rows. Cells center a rounded square ownership mark.
 */
export function ViewGrid({
  progress,
  hasInventory,
  tertiaryStatIconPaths = {},
}: ViewGridProps) {
  const { tertiaryStats, cells } = progress;

  if (tertiaryStats.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        No tertiary stats available for this archetype yet. Sync the manifest
        to populate archetype stat pairs.
      </div>
    );
  }

  return (
    // Tracker width is sized exactly to fit the 5-column grid (120 slot col +
    // 4 × 100 stat cols = 520px), so the inner table never needs to scroll
    // horizontally. We use `overflow-hidden` instead of `overflow-x-auto` to
    // prevent sub-pixel flex rounding from triggering a phantom scrollbar
    // — and so the canvas wheel handler doesn't defer two-finger trackpad
    // swipes into a non-scrollable container.
    <div className="overflow-hidden">
      <div
        role="table"
        aria-label="Tertiary stat ownership grid"
        className="flex min-w-max flex-col gap-4"
      >
        {/* Header row */}
        <div role="row" className="flex items-center">
          <div
            role="columnheader"
            className="flex h-6 w-[120px] items-center p-2 text-base text-white/45"
          >
            <span className="truncate">Tertiary stat</span>
          </div>
          {tertiaryStats.map((t) => {
            const iconPath = tertiaryStatIconPaths[t];
            return (
              <div
                key={t}
                role="columnheader"
                className="flex h-6 w-[100px] items-center gap-1 p-2 text-base text-white/45"
              >
                {iconPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN; plain img avoids next/image remote config
                  <img
                    src={bungieIconUrl(iconPath)}
                    width={18}
                    height={18}
                    alt=""
                    className="h-[18px] w-[18px] shrink-0 object-contain opacity-80"
                    loading="lazy"
                  />
                ) : null}
                <span className="truncate">{t}</span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div role="rowgroup" className="flex items-start">
          {/* Slot name column */}
          <div className="flex w-[120px] shrink-0 flex-col">
            {SLOT_ORDER.map((slot, i) => (
              <div
                key={slot}
                role="rowheader"
                className={`flex h-12 items-center p-2 text-base font-medium text-white ${
                  i < SLOT_ORDER.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <span className="truncate">{SLOT_LABELS[slot]}</span>
              </div>
            ))}
          </div>

          {/* Stat columns */}
          {tertiaryStats.map((t) => (
            <div key={t} className="flex w-[100px] shrink-0 flex-col">
              {SLOT_ORDER.map((slot, i) => {
                const matches = cells[slot][t] ?? [];
                const state: OwnershipState = !hasInventory
                  ? "loading"
                  : matches.length > 0
                    ? "owned"
                    : "missing";
                const isDuplicate = state === "owned" && matches.length > 1;
                return (
                  <div
                    key={slot}
                    role="cell"
                    title={cellTitle(state, matches)}
                    className={`flex h-12 items-center justify-center p-2 ${
                      i < SLOT_ORDER.length - 1
                        ? "border-b border-white/10"
                        : ""
                    }`}
                  >
                    {/*
                     * Wrapper keeps the OwnershipIcon centered in the cell
                     * regardless of the duplicate badge — the red square
                     * is absolute-positioned so it doesn't shift the icon
                     * between dupe / non-dupe rows.
                     */}
                    <div className="relative">
                      <OwnershipIcon state={state} count={matches.length} />
                      {isDuplicate ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-full top-1/2 ml-1.5 h-2 w-2 -translate-y-1/2 bg-[#ff3b30] shadow-[0_0_4px_-1px_rgba(255,59,48,0.6)]"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
