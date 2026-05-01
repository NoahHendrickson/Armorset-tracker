import {
  CheckCircle,
  Circle,
  CircleDashed,
} from "@phosphor-icons/react/dist/ssr";

export type OwnershipState = "owned" | "missing" | "loading";

interface OwnershipIconProps {
  state: OwnershipState;
  count?: number;
}

export function OwnershipIcon({ state, count }: OwnershipIconProps) {
  if (state === "loading") {
    return (
      <span
        role="img"
        aria-label="Loading ownership state"
        className="inline-flex items-center text-muted-foreground"
      >
        <CircleDashed className="h-5 w-5 animate-spin" />
        <span className="sr-only">Unknown</span>
      </span>
    );
  }
  if (state === "owned") {
    return (
      <span
        role="img"
        aria-label={
          typeof count === "number" && count > 1
            ? `Owned (${count} matching pieces)`
            : "Owned"
        }
        className="inline-flex items-center gap-1 text-success"
      >
        <CheckCircle weight="fill" className="h-5 w-5" />
        <span className="sr-only">Owned</span>
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Not owned"
      className="inline-flex items-center text-muted-foreground"
    >
      <Circle className="h-5 w-5" />
      <span className="sr-only">Not owned</span>
    </span>
  );
}
