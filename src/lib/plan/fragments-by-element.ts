import type { FragmentPlugPayload } from "@/lib/views/optimizer-lookup-payload";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";

export const FRAGMENT_ELEMENT_TABS = [
  "arc",
  "solar",
  "void",
  "stasis",
  "strand",
  "prismatic",
] as const;

export type FragmentElementTab = (typeof FRAGMENT_ELEMENT_TABS)[number];

export function fragmentElementKey(subclassKey: string): string {
  return subclassKey.split(".")[0] ?? subclassKey;
}

/** Fragments with at least one stat delta for the given element tab. */
export function statFragmentsForElement(
  lookup: OptimizerLookupPayload,
  element: FragmentElementTab,
): FragmentPlugPayload[] {
  return lookup.fragmentPlugs.filter(
    (frag) =>
      fragmentElementKey(frag.subclassKey) === element &&
      frag.deltas.some((delta) => delta.value !== 0),
  );
}

export function formatFragmentElementLabel(element: FragmentElementTab): string {
  return element.charAt(0).toUpperCase() + element.slice(1);
}
