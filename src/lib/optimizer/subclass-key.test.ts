import { describe, expect, it } from "vitest";
import {
  classTypeFromSubclassKey,
  optimizerFragmentCatalogComplete,
  parseSubclassKeyFromPlugCategory,
  subclassLabel,
  subclassesForClassType,
} from "@/lib/optimizer/subclass-key";

describe("subclass-key", () => {
  it("parses element and class from plug category identifier", () => {
    expect(
      parseSubclassKeyFromPlugCategory(
        "enhancements.v2_void.warlock.fragments.echo_of_exchange",
      ),
    ).toBe("void.warlock");
    expect(
      parseSubclassKeyFromPlugCategory("enhancements.v2_prismatic.fragments"),
    ).toBe("prismatic");
    expect(parseSubclassKeyFromPlugCategory("shared.prism.fragments")).toBe(
      "prismatic",
    );
    expect(parseSubclassKeyFromPlugCategory("shared.stasis.trinkets")).toBe(
      "stasis",
    );
  });

  it("maps subclass keys to class types and labels", () => {
    expect(classTypeFromSubclassKey("solar.titan")).toBe(0);
    expect(subclassLabel("solar.titan")).toBe("Solar Titan");
  });

  it("filters subclass keys by class type", () => {
    const keys = ["void.warlock", "solar.titan", "prismatic"];
    expect(subclassesForClassType(keys, 2)).toEqual(["prismatic", "void.warlock"]);
  });

  it("detects incomplete optimizer fragment catalogs", () => {
    expect(
      optimizerFragmentCatalogComplete(["solar", "void", "arc"], 60),
    ).toBe(false);
    expect(
      optimizerFragmentCatalogComplete(
        ["solar", "arc", "void", "stasis", "strand", "prismatic"],
        58,
      ),
    ).toBe(true);
    expect(
      optimizerFragmentCatalogComplete(
        ["solar", "arc", "void", "stasis", "strand", "prismatic"],
        0,
      ),
    ).toBe(false);
  });
});
