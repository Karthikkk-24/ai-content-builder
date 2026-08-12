import { describe, expect, it } from "vitest";
import { resolveClerkPrimaryEmail } from "@/lib/clerk-email";

describe("resolveClerkPrimaryEmail", () => {
  it("prefers the primary email id over array order", () => {
    expect(
      resolveClerkPrimaryEmail(
        [
          { id: "email_secondary", email_address: "second@example.com" },
          { id: "email_primary", email_address: "primary@example.com" },
        ],
        "email_primary"
      )
    ).toBe("primary@example.com");
  });

  it("falls back to the first address when primary id is missing", () => {
    expect(
      resolveClerkPrimaryEmail(
        [{ id: "email_1", email_address: "only@example.com" }],
        null
      )
    ).toBe("only@example.com");
  });

  it("returns empty string when no emails exist", () => {
    expect(resolveClerkPrimaryEmail([], "email_x")).toBe("");
    expect(resolveClerkPrimaryEmail(undefined, undefined)).toBe("");
  });
});
