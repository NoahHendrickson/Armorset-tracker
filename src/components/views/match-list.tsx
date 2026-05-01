"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import { Badge } from "@/components/ui/badge";
import type { DerivedArmorPieceJson } from "@/lib/db/types";

interface MatchListProps {
  matches: DerivedArmorPieceJson[];
}

function locationLabel(piece: DerivedArmorPieceJson): string {
  if (piece.location.kind === "vault") return "Vault";
  const cls = CLASS_NAMES[piece.location.classType] ?? "Unknown";
  return piece.location.equipped ? `${cls} (equipped)` : cls;
}

export function MatchList({ matches }: MatchListProps) {
  const [open, setOpen] = useState(false);

  if (matches.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (matches.length === 1) {
    return (
      <span className="text-xs text-muted-foreground">
        {locationLabel(matches[0])}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 self-start rounded-md text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring px-1.5 py-0.5 -ml-1.5 transition-colors"
        aria-expanded={open}
        aria-label={open ? "Hide matching pieces" : `Show ${matches.length} matching pieces`}
      >
        {open ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}
        <Badge variant="secondary" className="font-mono">
          {matches.length} owned
        </Badge>
      </button>
      {open ? (
        <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
          {matches.map((m) => (
            <li key={m.itemInstanceId} className="flex items-center gap-2">
              <span>{locationLabel(m)}</span>
              <code className="font-mono text-[10px] opacity-60">
                {m.itemInstanceId}
              </code>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
