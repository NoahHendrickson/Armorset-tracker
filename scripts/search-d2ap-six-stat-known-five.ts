/** Search only the reference five pieces (no full vault). */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const IDS = [
  "6917530125298828509",
  "6917530167771126356",
  "6917530146665347396",
  "6917530160150786116",
  "6917530147186685296",
] as const;

async function main(): Promise<void> {
  const SET = [
    { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
    { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
  ];
  const D2AP_6 = [
    { stat: "Weapons" as const, min: 200 },
    { stat: "Health" as const, min: 13 },
    { stat: "Class" as const, min: 42 },
    { stat: "Grenade" as const, min: 104 },
    { stat: "Melee" as const, min: 19 },
    { stat: "Super" as const, min: 101 },
  ];
  const MODS = { majorCount: 3, slotFill: true, artifice: true };

  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { estimateFilteredComboCount } = await import("../src/lib/optimizer/combo-count");

  const sb = getServiceRoleClient();
  const { data: rows } = await sb.from("inventory_cache").select("items");
  let inv: import("../src/lib/db/types").DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    const items = row.items as import("../src/lib/db/types").DerivedArmorPieceJson[];
    if (Array.isArray(items)) {
      inv.push(...items.filter((p) => p.classType === 2));
    }
  }
  const five = IDS.map((id) => inv.find((p) => p.itemInstanceId === id)).filter(
    (p): p is NonNullable<typeof p> => p != null,
  );
  const lock = {
    mode: "locked" as const,
    itemInstanceId: five[0]!.itemInstanceId,
    slot: five[0]!.slot,
  };

  const est = estimateFilteredComboCount(five, lock, {
    constraints: D2AP_6,
    setBonusSelections: SET,
    assumedMods: MODS,
    cap: 5,
  });
  console.log("5-piece estimate:", est);

  const sol = searchLoadouts({
    pool: five,
    constraints: D2AP_6,
    setBonusSelections: SET,
    assumedStatMods: MODS,
    exoticLock: lock,
    topN: 3,
  });
  console.log("5-piece search solutions:", sol.length);
  if (sol[0]) {
    console.log("slots:", sol[0].slots);
    console.log("totals:", sol[0].totals);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
