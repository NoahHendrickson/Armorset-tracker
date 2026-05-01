import { SLOT_LABELS, SLOT_ORDER } from "@/lib/bungie/constants";
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
}

export function ViewGrid({ progress, hasInventory }: ViewGridProps) {
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
          <TableHead className="w-[140px]">Slot</TableHead>
          {tertiaryStats.map((t) => (
            <TableHead key={t} className="text-center">
              +{t}
            </TableHead>
          ))}
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
