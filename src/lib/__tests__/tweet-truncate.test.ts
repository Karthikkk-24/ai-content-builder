import { describe, expect, it } from "vitest";
import {
  truncateToTweetLimit,
  TWEET_CHAR_LIMIT,
} from "@/lib/ai/text-generation";

describe("truncateToTweetLimit", () => {
  it("returns unchanged text under the limit", () => {
    expect(truncateToTweetLimit("short tweet")).toBe("short tweet");
    expect(truncateToTweetLimit("a".repeat(TWEET_CHAR_LIMIT))).toHaveLength(TWEET_CHAR_LIMIT);
  });

  it("crops long output to 280 with ellipsis", () => {
    const long = "word ".repeat(100).trim();
    const result = truncateToTweetLimit(long);
    expect(result.length).toBeLessThanOrEqual(TWEET_CHAR_LIMIT);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles text exactly at the limit", () => {
    const exact = "a".repeat(TWEET_CHAR_LIMIT);
    expect(truncateToTweetLimit(exact)).toBe(exact);
  });
});
