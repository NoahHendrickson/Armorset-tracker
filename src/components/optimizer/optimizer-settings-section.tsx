"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OptimizerSettingsSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  /** Tighter vertical rhythm for nested or paired sections. */
  compact?: boolean;
  className?: string;
}

/** Vertical stack section for the loadout optimizer settings column. */
export function OptimizerSettingsSection({
  id,
  title,
  children,
  compact = false,
  className,
}: OptimizerSettingsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "border-b border-border first:pt-0 last:border-b-0",
        compact ? "py-0" : "py-5",
        className,
      )}
    >
      <h2
        id={id}
        className="text-sm font-semibold tracking-wide text-foreground"
      >
        {title}
      </h2>
      <div className={compact ? "mt-2" : "mt-3"}>{children}</div>
    </section>
  );
}
