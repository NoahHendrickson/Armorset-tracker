import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";

export function solutionSignature(
  totals: Record<ArmorStatName, number>,
): string {
  return ARMOR_STAT_NAMES.map((stat) => `${stat}:${totals[stat] ?? 0}`).join(
    "|",
  );
}

export function groupSolutionsBySignature<T extends { signature: string }>(
  solutions: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const solution of solutions) {
    const list = groups.get(solution.signature) ?? [];
    list.push(solution);
    groups.set(solution.signature, list);
  }
  return groups;
}
