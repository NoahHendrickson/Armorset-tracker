export type OwnershipState = "owned" | "missing" | "loading";

interface OwnershipIconProps {
  state: OwnershipState;
  count?: number;
}

const baseSquare =
  "relative block size-6 shrink-0 rounded-[5px] pointer-events-none";

/**
 * Owned   = soft mint-green rounded square with a top highlight, bottom shading,
 *           hairline dark edge, and a faint outer glow (per Figma).
 * Missing = outlined rounded square.
 * Loading = outlined rounded square with a soft pulse while inventory is syncing.
 */
export function OwnershipIcon({ state, count }: OwnershipIconProps) {
  if (state === "loading") {
    return (
      <span
        role="img"
        aria-label="Loading ownership state"
        className={`${baseSquare} border-[1.5px] border-white/40 animate-pulse`}
      >
        <span className="sr-only">Loading</span>
      </span>
    );
  }

  if (state === "owned") {
    const label =
      typeof count === "number" && count > 1
        ? `Owned (${count} matching pieces)`
        : "Owned";
    return (
      <span
        role="img"
        aria-label={label}
        className={`${baseSquare} shadow-[0_0_10px_-1px_rgba(95,217,162,0.45)]`}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] bg-[#5fd9a2]"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_6px_-2px_rgba(0,0,0,0.18)]"
        />
        <span className="sr-only">Owned</span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Not owned"
      className={`${baseSquare} border-[1.5px] border-white/40`}
    >
      <span className="sr-only">Not owned</span>
    </span>
  );
}
