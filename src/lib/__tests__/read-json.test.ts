import { describe, expect, it } from "vitest";
import {
  AI_JSON_BODY_LIMIT_BYTES,
  readJsonBody,
  readRawBody,
} from "@/lib/api/read-json";

function makeRequest(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body,
  });
}

describe("readJsonBody", () => {
  it("parses valid JSON under the limit", async () => {
    const result = await readJsonBody(
      makeRequest(JSON.stringify({ prompt: "hi" })),
      AI_JSON_BODY_LIMIT_BYTES
    );
    expect(result).toEqual({ ok: true, data: { prompt: "hi" } });
  });

  it("rejects oversized Content-Length", async () => {
    const result = await readJsonBody(
      makeRequest("{}", { "content-length": String(AI_JSON_BODY_LIMIT_BYTES + 1) }),
      AI_JSON_BODY_LIMIT_BYTES
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });

  it("rejects oversized body text", async () => {
    const huge = JSON.stringify({ prompt: "x".repeat(AI_JSON_BODY_LIMIT_BYTES) });
    const result = await readJsonBody(makeRequest(huge), AI_JSON_BODY_LIMIT_BYTES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });

  it("rejects invalid JSON", async () => {
    const result = await readJsonBody(makeRequest("{nope"), 1_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});

describe("readRawBody", () => {
  it("returns UTF-8 text under the limit", async () => {
    const result = await readRawBody(makeRequest('{"ok":true}'), 1_000);
    expect(result).toEqual({ ok: true, text: '{"ok":true}' });
  });

  it("stops streaming once the byte cap is exceeded", async () => {
    const result = await readRawBody(makeRequest("x".repeat(50)), 16);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });
});
