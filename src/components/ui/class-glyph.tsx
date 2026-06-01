/** Class glyph assets (static; manifest does not ship class icons). */
const CLASS_GLYPH_SRC: Record<number, string> = {
  0: "/class-icons/titan.svg",
  1: "/class-icons/hunter.svg",
  2: "/class-icons/warlock.svg",
};

export function ClassGlyph({
  classType,
  className,
}: {
  classType: number;
  className?: string;
}) {
  const src = CLASS_GLYPH_SRC[classType];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static asset; plain img keeps currentColor + sizing simple
      <img src={src} alt="" aria-hidden className={className} />
    );
  }
  return (
    <svg
      width="30"
      height="15"
      viewBox="0 0 30 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M0 15 L7.5 0 L15 15 Z" fill="currentColor" />
      <path d="M15 15 L22.5 0 L30 15 Z" fill="currentColor" />
    </svg>
  );
}
