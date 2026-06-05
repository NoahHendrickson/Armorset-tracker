"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  coercePlanStatGoals,
  type PlanStatGoals,
} from "@/lib/plan/plan-stat-goals";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";

export type PlanStatGoalsPickerProps = {
  value: Partial<PlanStatGoals>;
  onChange: (next: PlanStatGoals) => void;
  statIconByName?: GridLookupPayload["statIconByName"];
};

export function PlanStatGoalsPicker({
  value,
  onChange,
  statIconByName = {},
}: PlanStatGoalsPickerProps) {
  const goals = coercePlanStatGoals(value);

  const setPrimary = (primaryStat: ArmorStatName) => {
    const next = coercePlanStatGoals({ ...goals, primaryStat });
    onChange(next);
  };

  const setSecondary = (secondaryStat: ArmorStatName) => {
    const next = coercePlanStatGoals({ ...goals, secondaryStat });
    onChange(next);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatGoalField
        id="plan-primary-stat"
        label="Primary stat"
        stat={goals.primaryStat}
        onStatChange={setPrimary}
        statIconByName={statIconByName}
      />
      <StatGoalField
        id="plan-secondary-stat"
        label="Secondary stat"
        stat={goals.secondaryStat}
        onStatChange={setSecondary}
        statIconByName={statIconByName}
        excludeStat={goals.primaryStat}
      />
    </div>
  );
}

function StatGoalField({
  id,
  label,
  stat,
  onStatChange,
  statIconByName,
  excludeStat,
}: {
  id: string;
  label: string;
  stat: ArmorStatName;
  onStatChange: (stat: ArmorStatName) => void;
  statIconByName: GridLookupPayload["statIconByName"];
  excludeStat?: ArmorStatName;
}) {
  const options = ARMOR_STAT_NAMES.filter((s) => s !== excludeStat);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Select value={stat} onValueChange={(v) => onStatChange(v as ArmorStatName)}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue>
            <span className="flex items-center gap-2">
              <ArmorStatIcon
                stat={stat}
                iconPath={statIconByName[stat]}
                size="sm"
              />
              {stat}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <span className="flex items-center gap-2">
                <ArmorStatIcon
                  stat={option}
                  iconPath={statIconByName[option]}
                  size="sm"
                />
                {option}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
