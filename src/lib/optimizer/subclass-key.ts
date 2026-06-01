const SUBCLASS_ELEMENTS = [
  "solar",
  "arc",
  "void",
  "stasis",
  "strand",
  "prismatic",
] as const;

const SUBCLASS_CLASSES = ["titan", "hunter", "warlock"] as const;

/** Element subclasses shown in the optimizer (Bungie uses shared.{element}.fragments). */
export const CANONICAL_OPTIMIZER_SUBCLASS_KEYS = [
  ...SUBCLASS_ELEMENTS,
] as const;

export type OptimizerSubclassKey =
  (typeof CANONICAL_OPTIMIZER_SUBCLASS_KEYS)[number];

export function optimizerFragmentCatalogComplete(
  subclassKeys: Iterable<string>,
  plugCount: number,
): boolean {
  const keys = new Set(subclassKeys);
  if (plugCount <= 0) return false;
  return CANONICAL_OPTIMIZER_SUBCLASS_KEYS.every((key) => keys.has(key));
}

/** Parse manifest plugCategoryIdentifier into a stable subclass key. */
export function parseSubclassKeyFromPlugCategory(categoryId: string): string {
  const lower = categoryId.toLowerCase();
  const tokens = lower.split(/[._]+/);
  let element = "";
  for (const e of SUBCLASS_ELEMENTS) {
    if (tokens.includes(e)) {
      element = e;
      break;
    }
  }
  if (!element && tokens.includes("prism")) {
    element = "prismatic";
  }
  if (!element) return "unknown";
  for (const c of SUBCLASS_CLASSES) {
    if (tokens.includes(c)) {
      return `${element}.${c}`;
    }
  }
  return element;
}

export function classTypeFromSubclassKey(key: string): number | undefined {
  if (key.endsWith(".titan")) return 0;
  if (key.endsWith(".hunter")) return 1;
  if (key.endsWith(".warlock")) return 2;
  return undefined;
}

export function subclassLabel(key: string): string {
  const [element, cls] = key.split(".");
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  if (cls) return `${cap(element ?? key)} ${cap(cls)}`;
  return cap(element ?? key);
}

export function subclassesForClassType(
  keys: Iterable<string>,
  classType: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    const keyClass = classTypeFromSubclassKey(key);
    if (keyClass !== undefined && keyClass !== classType) continue;
    seen.add(key);
    out.push(key);
  }
  out.sort((a, b) => subclassLabel(a).localeCompare(subclassLabel(b)));
  return out;
}
