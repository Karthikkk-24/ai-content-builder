import { describe, expect, it } from "vitest";
import { mergeForcedGenerationContext } from "@/lib/ai/text-generate-route";

describe("mergeForcedGenerationContext", () => {
  it("overwrites client generationType when force is set (tweet abuse path)", () => {
    expect(
      mergeForcedGenerationContext(
        { generationType: "blog", tone: "witty" },
        "tweet"
      )
    ).toEqual({ generationType: "tweet", tone: "witty" });
  });

  it("leaves client generationType when force is omitted", () => {
    expect(
      mergeForcedGenerationContext({ generationType: "caption" }, undefined)
    ).toEqual({ generationType: "caption" });
  });

  it("sets generationType when context is empty", () => {
    expect(mergeForcedGenerationContext(undefined, "blog")).toEqual({
      generationType: "blog",
    });
  });
});
