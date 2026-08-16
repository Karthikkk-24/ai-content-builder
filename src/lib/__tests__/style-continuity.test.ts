import { describe, expect, it } from "vitest";
import {
  fingerprintFromDescription,
  formatStyleSoftConstraints,
  normalizeStyleFingerprint,
} from "@/lib/ai/style-continuity";

describe("style continuity", () => {
  it("extracts mood and color cues from a description", () => {
    const style = fingerprintFromDescription(
      "A cinematic warm portrait with gold light and soft teal accents"
    );
    expect(style.moodWords).toEqual(
      expect.arrayContaining(["cinematic", "warm", "soft"])
    );
    expect(style.dominantColors).toEqual(
      expect.arrayContaining(["gold", "teal"])
    );
    expect(style.summary.toLowerCase()).toContain("cinematic");
  });

  it("formats soft constraints for prompt injection", () => {
    const text = formatStyleSoftConstraints({
      summary: "moody night city",
      moodWords: ["moody", "dark"],
      dominantColors: ["blue", "black"],
      compositionNotes: "wide establishing shot",
    });
    expect(text).toContain("Mood: moody, dark");
    expect(text).toContain("Dominant colors: blue, black");
    expect(text).toContain("Prior look summary: moody night city");
    expect(text).toContain("<<BEGIN_UNTRUSTED_USER_CONTENT>>");
    expect(text).toContain("<<END_UNTRUSTED_USER_CONTENT>>");
    const begin = text.indexOf("<<BEGIN_UNTRUSTED_USER_CONTENT>>");
    const summaryAt = text.indexOf("Prior look summary:");
    expect(begin).toBeGreaterThan(-1);
    expect(summaryAt).toBeGreaterThan(begin);
  });

  it("normalizes client-provided fingerprints", () => {
    expect(normalizeStyleFingerprint(null)).toBeNull();
    expect(
      normalizeStyleFingerprint({
        summary: "keep the neon vibe",
        moodWords: ["neon", "vibrant"],
        dominantColors: ["#0ff", "magenta"],
      })?.moodWords
    ).toEqual(["neon", "vibrant"]);
  });
});
