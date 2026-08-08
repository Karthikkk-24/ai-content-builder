import { describe, expect, it } from "vitest";
import { encodeSse } from "@/lib/ai/sse";

describe("encodeSse", () => {
  it("formats delta events as SSE data lines", () => {
    expect(encodeSse({ type: "delta", text: "hi" })).toBe(
      'data: {"type":"delta","text":"hi"}\n\n'
    );
  });

  it("formats done events", () => {
    const encoded = encodeSse({
      type: "done",
      output: "final",
      provider: "gemini",
    });
    expect(encoded).toContain('"type":"done"');
    expect(encoded).toContain('"provider":"gemini"');
    expect(encoded.endsWith("\n\n")).toBe(true);
  });
});
