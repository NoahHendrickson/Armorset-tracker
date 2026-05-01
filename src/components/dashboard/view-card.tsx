import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CLASS_NAMES, SLOT_ORDER } from "@/lib/bungie/constants";
import type { ViewRow } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";

interface ViewCardProps {
  view: ViewRow;
  progress: ViewProgress;
  setName: string;
  archetypeName: string;
  tuningName: string;
}

export function ViewCard({
  view,
  progress,
  setName,
  archetypeName,
  tuningName,
}: ViewCardProps) {
  const complete =
    progress.totalCells > 0 && progress.ownedCells === progress.totalCells;
  const className =
    Number(view.class_type) >= 0
      ? CLASS_NAMES[Number(view.class_type)]
      : null;

  return (
    <Link
      href={`/views/${view.id}`}
      className="group block focus:outline-none"
      aria-label={`Open view ${view.name}`}
    >
      <Card className="h-full transition-colors group-hover:border-foreground/20 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold tracking-tight">
                {view.name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {className ? `${className} · ` : ""}
                {setName} &middot; {archetypeName} &middot; {tuningName}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              weight="duotone"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-end justify-between gap-3">
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {progress.ownedCells}
              <span className="text-muted-foreground">/{progress.totalCells}</span>
            </div>
            <div
              className={
                "rounded-full px-2 py-0.5 text-xs font-medium " +
                (complete
                  ? "bg-success/15 text-success-foreground/80"
                  : "bg-muted text-muted-foreground")
              }
            >
              {complete ? "Complete" : "In progress"}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {SLOT_ORDER.map((slot) => {
              const slotCells = progress.cells[slot];
              const ownedInSlot = progress.tertiaryStats.filter(
                (t) => (slotCells[t]?.length ?? 0) > 0,
              ).length;
              const total = progress.tertiaryStats.length;
              const fullyOwned = total > 0 && ownedInSlot === total;
              const partiallyOwned = ownedInSlot > 0 && ownedInSlot < total;
              return (
                <div
                  key={slot}
                  aria-label={`${slot}: ${ownedInSlot}/${total} tertiaries owned`}
                  className={
                    "h-1.5 rounded-full " +
                    (fullyOwned
                      ? "bg-foreground"
                      : partiallyOwned
                        ? "bg-foreground/40"
                        : "bg-muted")
                  }
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
