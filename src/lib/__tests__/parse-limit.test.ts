import { describe, expect, it } from "vitest";
import { parseLimitParam } from "@/lib/api/parse-limit";

describe("parseLimitParam", () => {
  const opts = { defaultLimit: 50, maxLimit: 100 };

  it("uses default when missing or empty", () => {
    expect(parseLimitParam(null, opts)).toBe(50);
    expect(parseLimitParam("", opts)).toBe(50);
    expect(parseLimitParam("   ", opts)).toBe(50);
  });

  it("parses valid integers and clamps to max", () => {
    expect(parseLimitParam("10", opts)).toBe(10);
    expect(parseLimitParam("100", opts)).toBe(100);
    expect(parseLimitParam("999", opts)).toBe(50); // invalid → default via catch
  });

  it("rejects NaN, negatives, and zero", () => {
    expect(parseLimitParam("abc", opts)).toBe(50);
    expect(parseLimitParam("-5", opts)).toBe(50);
    expect(parseLimitParam("0", opts)).toBe(50);
  });
});
