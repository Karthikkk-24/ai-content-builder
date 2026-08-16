import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetEnvValidationForTests,
  assertRequiredEnvAtBoot,
  validateEnv,
} from "@/lib/env";

describe("validateEnv", () => {
  afterEach(() => {
    __resetEnvValidationForTests();
    vi.unstubAllEnvs();
  });

  it("throws when required keys are missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    expect(() => validateEnv()).toThrow(/Environment validation failed/);
  });

  it("returns parsed env when required keys are valid", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost/db");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_123");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "gkey");
    expect(validateEnv().CLERK_SECRET_KEY).toBe("sk_test_123");
  });

  it("fails closed at boot in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    expect(() => assertRequiredEnvAtBoot()).toThrow(
      /Environment validation failed/
    );
  });
});
