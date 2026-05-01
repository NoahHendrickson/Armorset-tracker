import { SLOT_LABELS, SLOT_ORDER, bungieIconUrl } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OwnershipIcon } from "./ownership-icon";
import { MatchList } from "./match-list";
import type { ViewProgress } from "@/lib/views/progress";

interface ViewGridProps {
  progress: ViewProgress;
  hasInventory: boolean;
  /** Relative manifest icon paths keyed by tertiary stat name. */
  tertiaryStatIconPaths?: Partial<Record<ArmorStatName, string>>;
}

export function ViewGrid({
  progress,
  hasInventory,
  tertiaryStatIconPaths = {},
}: ViewGridProps) {
  const { tertiaryStats, cells } = progress;

  if (tertiaryStats.length === 0) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        No tertiary stats available for this archetype yet. Sync the manifest
        to populate archetype stat pairs.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Tertiary stat</TableHead>
          {tertiaryStats.map((t) => {
            const iconPath = tertiaryStatIconPaths[t];
            return (
              <TableHead key={t} className="text-center">
                <span className="inline-flex items-center justify-center gap-1.5">
                  {iconPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN; plain img avoids next/image remote config
                    <img
                      src={bungieIconUrl(iconPath)}
                      width={20}
                      height={20}
                      alt=""
                      title={t}
                      className="size-5 shrink-0 object-contain brightness-0 opacity-85 dark:brightness-100 dark:opacity-100"
                      loading="lazy"
                    />
                  ) : null}
                  <span>{t}</span>
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {SLOT_ORDER.map((slot) => (
          <TableRow key={slot}>
            <TableCell className="font-medium align-top">
              {SLOT_LABELS[slot]}
            </TableCell>
            {tertiaryStats.map((t) => {
              const matches = cells[slot][t] ?? [];
              const state = !hasInventory
                ? "loading"
                : matches.length > 0
                  ? "owned"
                  : "missing";
              return (
                <TableCell key={t} className="text-center align-top">
                  <div className="flex flex-col items-center gap-1.5">
                    <OwnershipIcon state={state} count={matches.length} />
                    {hasInventory ? (
                      <MatchList matches={matches} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    )}
                  </div>
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
