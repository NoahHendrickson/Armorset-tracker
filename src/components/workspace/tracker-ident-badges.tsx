import { Badge } from "@/components/ui/badge";

const trackerBadgeClass =
  "min-w-0 max-w-[min(100%,14rem)] shrink truncate rounded-none border border-[#00FF85] bg-[#00FF85]/14 px-3 py-1.5 text-sm font-medium leading-snug text-white shadow-none";

interface TrackerIdentBadgesProps {
  setName: string;
  archetypeName: string;
}

/**
 * Armor set + archetype pills for canvas tracker headers (tuning uses {@link TuningHeaderGlyph}).
 */
export function TrackerIdentBadges({
  setName,
  archetypeName,
}: TrackerIdentBadgesProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Badge variant="outline" className={trackerBadgeClass} title={setName}>
        {setName}
      </Badge>
      <Badge variant="outline" className={trackerBadgeClass} title={archetypeName}>
        {archetypeName}
      </Badge>
    </div>
  );
}
