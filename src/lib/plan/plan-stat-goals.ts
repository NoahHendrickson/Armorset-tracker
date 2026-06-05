import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";

export type PlanStatGoals = {
  /** Stat to reach 200 on the 0–200 track (mods applied without overshooting when possible). */
  primaryStat: ArmorStatName;
  /** Stat to maximize with any mod budget left after the primary target. */
  secondaryStat: ArmorStatName;
};

export const DEFAULT_PLAN_STAT_GOALS: PlanStatGoals = {
  primaryStat: "Weapons",
  secondaryStat: "Super",
};

export function coercePlanStatGoals(
  goals: Partial<PlanStatGoals> | null | undefined,
): PlanStatGoals {
  const primary =
    goals?.primaryStat != null && ARMOR_STAT_NAMES.includes(goals.primaryStat)
      ? goals.primaryStat
      : DEFAULT_PLAN_STAT_GOALS.primaryStat;
  let secondary =
    goals?.secondaryStat != null && ARMOR_STAT_NAMES.includes(goals.secondaryStat)
      ? goals.secondaryStat
      : DEFAULT_PLAN_STAT_GOALS.secondaryStat;
  if (secondary === primary) {
    secondary =
      ARMOR_STAT_NAMES.find((stat) => stat !== primary) ??
      DEFAULT_PLAN_STAT_GOALS.secondaryStat;
  }
  return { primaryStat: primary, secondaryStat: secondary };
}
