import type { ViewDiagnostics } from "@/lib/views/progress";

export interface DiagnosticsBanner {
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
  /**
   * When true, the workspace tracker skips the diagnostics card entirely.
   * Used for the default “everything lines up — see grid for per-cell gaps” caption.
   */
  omitTrackerPanel?: boolean;
}

/** Derives diagnostics banner title/detail for inventory vs view filters (shared UI + tracker visibility). */
export function inferDiagnosticsBanner(
  d: ViewDiagnostics,
  className: string | null,
): DiagnosticsBanner {
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

  // Class-scoped views narrate progress in terms of the user's own class so
  // they can act on the right character. Unscoped views fall back to the
  // legacy cross-class summary.
  if (className) {
    return classScopedBanner(d, className);
  }
  return unscopedBanner(d);
}

function classScopedBanner(
  d: ViewDiagnostics,
  className: string,
): DiagnosticsBanner {
  if (d.matchingSetInClass === 0) {
    if (d.matchingSet > 0) {
      return {
        severity: "info",
        title: `You don't own this set on your ${className} yet`,
        detail: `${d.matchingSet} piece(s) of this set are in your inventory across other classes — none on your ${className}. Switch the view's class, or chase rolls on this character.`,
      };
    }
    return {
      severity: "info",
      title: "You don't own any pieces from this set yet",
      detail:
        "Pick a different set, or grind some encounters that drop this set. The view will fill in as you collect pieces.",
    };
  }

  if (d.matchingAllInClass > 0) {
    return {
      severity: "info",
      title: "Match summary",
      detail:
        "Counts of how many pieces in your inventory match each filter. The grid above splits matches by tertiary stat, so missing cells just mean you don't have that specific tertiary roll yet.",
      omitTrackerPanel: true,
    };
  }

  // Have set on class, but no piece has all 3 filters together. Identify
  // which filter is the closest miss to give an actionable hint.
  const hasSetAndArch = d.matchingSetAndArchetypeInClass > 0;
  const hasSetAndTune = d.matchingSetAndTuningInClass > 0;
  const crossClassHint =
    d.matchingAll > 0
      ? ` ${d.matchingAll} piece(s) on other classes match all three.`
      : "";

  if (hasSetAndArch && !hasSetAndTune) {
    return {
      severity: "info",
      title: `Almost there on your ${className}`,
      detail: `${d.matchingSetAndArchetypeInClass} ${className} piece(s) match this set + archetype, but every one of them has a different tuning committed to it. Tuning locks in once installed — chase a re-roll (or an uncommitted piece), or change the view's tuning to one you already have.${crossClassHint}`,
    };
  }
  if (hasSetAndTune && !hasSetAndArch) {
    return {
      severity: "info",
      title: `Almost there on your ${className}`,
      detail: `${d.matchingSetAndTuningInClass} ${className} piece(s) match this set + tuning, but on a different archetype. Archetype is fixed at drop — chase a re-roll, or change the view's archetype.${crossClassHint}`,
    };
  }
  if (hasSetAndArch && hasSetAndTune) {
    return {
      severity: "info",
      title: `Almost there on your ${className}`,
      detail: `${d.matchingSetAndArchetypeInClass} ${className} piece(s) match set + archetype, ${d.matchingSetAndTuningInClass} match set + tuning — none combine all three on a single piece yet.${crossClassHint}`,
    };
  }

  return {
    severity: "info",
    title: `Your ${className} pieces from this set don't have these rolls`,
    detail: `${d.matchingSetInClass} ${className} piece(s) of this set are in your inventory, but none match this archetype or tuning. Both are fixed once committed — chase re-rolls, or change the view's filters.${crossClassHint}`,
  };
}

function unscopedBanner(d: ViewDiagnostics): DiagnosticsBanner {
  if (d.matchingSet === 0) {
    return {
      severity: "info",
      title: "You don't own any pieces from this set yet",
      detail:
        "Pick a different set, or grind some encounters that drop this set. The view will fill in as you collect pieces.",
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
    omitTrackerPanel: true,
  };
}
