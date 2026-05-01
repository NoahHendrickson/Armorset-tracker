import { Info, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { ViewDiagnostics } from "@/lib/views/progress";

interface Props {
  diagnostics: ViewDiagnostics;
  setName: string;
  archetypeName: string;
  tuningName: string;
  className: string | null;
}

export function ViewDiagnosticsPanel({
  diagnostics,
  setName,
  archetypeName,
  tuningName,
  className,
}: Props) {
  const d = diagnostics;
  const reason = inferReason(d, className);

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        {reason.severity === "info" ? (
          <Info weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        ) : reason.severity === "warning" ? (
          <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <XCircle weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="flex-1">
          <p className="font-medium">{reason.title}</p>
          <p className="text-muted-foreground">{reason.detail}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pl-7 text-xs sm:grid-cols-3">
        <Row label="Total armor pieces" value={d.totalInventory} />
        {className ? (
          <Row label={`In class: ${className}`} value={d.classFiltered} />
        ) : null}
        <Row label="With set assigned" value={d.withAnySetHash} />
        <Row label="With archetype" value={d.withAnyArchetypeHash} />
        <Row label="With tuning" value={d.withAnyTuningHash} />
        <Row label="With tertiary stat" value={d.withAnyTertiary} />
        <Row label={`Set: ${setName}`} value={d.matchingSet} />
        <Row label={`Archetype: ${archetypeName}`} value={d.matchingArchetype} />
        <Row label={`Tuning: ${tuningName}`} value={d.matchingTuning} />
        <Row label="Set + archetype" value={d.matchingSetAndArchetype} />
        <Row label="Set + tuning" value={d.matchingSetAndTuning} />
        <Row label="All filters" value={d.matchingAll} />
        {className ? (
          <Row
            label="All filters + class"
            value={d.matchingAllInClass}
            highlight
          />
        ) : null}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 truncate">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight
            ? "font-mono font-semibold tabular-nums"
            : "font-mono tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

interface Reason {
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
}

function inferReason(d: ViewDiagnostics, className: string | null): Reason {
  if (d.totalInventory === 0) {
    return {
      severity: "warning",
      title: "No inventory synced yet",
      detail:
        "Click Refresh above to pull your gear from Bungie. If this persists, you may need to sign out and back in.",
    };
  }
  if (!d.archetypePairKnown) {
    return {
      severity: "error",
      title: "Archetype stat pair not in manifest",
      detail:
        "We don't have a primary/secondary stat pair recorded for this archetype, so we can't compute the 4 tertiary columns. Try resyncing the manifest.",
    };
  }
  if (d.withAnySetHash === 0) {
    return {
      severity: "error",
      title: "Inventory loaded, but no piece is mapped to a set",
      detail:
        "The manifest derivation didn't match any of your pieces to a known armor set. Resync the manifest from the dashboard.",
    };
  }
  if (d.withAnyArchetypeHash === 0 && d.withAnyTuningHash === 0) {
    return {
      severity: "error",
      title: "No archetype/tuning detected on any piece",
      detail:
        "We can see your armor but socket plugs aren't being classified. Resync the manifest first; if it persists, this is a derivation bug.",
    };
  }
  if (d.withAnyTertiary === 0) {
    return {
      severity: "error",
      title: "No tertiary stats detected",
      detail:
        "Stat plugs aren't being decoded. The manifest may be missing armor_stat_plugs — try resyncing.",
    };
  }
  if (d.matchingSet === 0) {
    return {
      severity: "info",
      title: "You don't own any pieces from this set yet",
      detail:
        "Pick a different set, or grind some encounters that drop this set. The view will fill in as you collect pieces.",
    };
  }
  if (className && d.classFiltered > 0 && d.matchingAll > 0 && d.matchingAllInClass === 0) {
    return {
      severity: "info",
      title: `You own matching rolls — but none on your ${className}`,
      detail: `${d.matchingAll} piece(s) match the set/archetype/tuning, but none belong to your ${className}. Switch class on the view, or chase rolls on this character.`,
    };
  }
  if (d.matchingSetAndArchetype === 0 && d.matchingSetAndTuning === 0) {
    return {
      severity: "info",
      title: "You own this set, but with different rolls",
      detail: `${d.matchingSet} piece(s) of this set are in your inventory — none currently have this archetype or tuning combination.`,
    };
  }
  if (d.matchingAll === 0) {
    return {
      severity: "info",
      title: "Almost there — you own pieces with each filter, just not all three at once",
      detail: `${d.matchingSetAndArchetype} piece(s) match the set + archetype, ${d.matchingSetAndTuning} match the set + tuning, but none have all three filters together yet.`,
    };
  }
  return {
    severity: "info",
    title: "Match summary",
    detail:
      "Counts of how many pieces in your inventory match each filter. The grid above splits matches by tertiary stat, so missing cells just mean you don't have that specific tertiary roll yet.",
  };
}
