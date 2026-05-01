import { Info, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import { inferDiagnosticsBanner } from "@/lib/views/infer-diagnostics-banner";
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
  const reason = inferDiagnosticsBanner(d, className);

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        {reason.severity === "info" ? (
          <Info weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        ) : reason.severity === "warning" ? (
          <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <XCircle weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
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
        {className ? (
          <>
            <Row
              label={`${setName} on ${className}`}
              value={d.matchingSetInClass}
            />
            <Row
              label={`${archetypeName} on ${className}`}
              value={d.matchingArchetypeInClass}
            />
            <Row
              label={`${tuningName} on ${className}`}
              value={d.matchingTuningInClass}
            />
            <Row
              label={`Set + archetype on ${className}`}
              value={d.matchingSetAndArchetypeInClass}
            />
            <Row
              label={`Set + tuning on ${className}`}
              value={d.matchingSetAndTuningInClass}
            />
            <Row
              label={`All filters on ${className}`}
              value={d.matchingAllInClass}
              highlight
            />
          </>
        ) : (
          <>
            <Row label={`Set: ${setName}`} value={d.matchingSet} />
            <Row
              label={`Archetype: ${archetypeName}`}
              value={d.matchingArchetype}
            />
            <Row label={`Tuning: ${tuningName}`} value={d.matchingTuning} />
            <Row label="Set + archetype" value={d.matchingSetAndArchetype} />
            <Row label="Set + tuning" value={d.matchingSetAndTuning} />
            <Row label="All filters" value={d.matchingAll} highlight />
          </>
        )}
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
