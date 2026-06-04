"use client";

export type OptimizerStatTargetsNoticeProps = {
  noTier5: boolean;
  missingStatData: boolean;
  missingSlotCoverage: boolean;
  searchTooLarge: boolean;
  canGenerateBuilds: boolean;
};

/** Fixed-height notice slot above stat sliders — avoids layout jump when combo estimates change. */
export function OptimizerStatTargetsNotice({
  noTier5,
  missingStatData,
  missingSlotCoverage,
  searchTooLarge,
  canGenerateBuilds,
}: OptimizerStatTargetsNoticeProps) {
  let message: string | null = null;

  if (noTier5) {
    message =
      "No Tier 5 armor found for this class. Refresh inventory or pick a class with Tier 5 pieces.";
  } else if (missingStatData) {
    message =
      "Tier 5 pieces are missing stat data. Refresh inventory from the header.";
  } else if (missingSlotCoverage) {
    message =
      "Your Tier 5 pool doesn't cover every slot — you need helmet, arms, chest, legs, and a class item.";
  } else if (searchTooLarge && canGenerateBuilds) {
    message = "Large search — shaded bands are estimates.";
  }

  return (
    <div className="min-h-10" aria-live="polite">
      {message ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">{message}</p>
      ) : null}
    </div>
  );
}
