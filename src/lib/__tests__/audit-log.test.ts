import { describe, expect, it, vi, afterEach } from "vitest";
import { apiError, logSecurityEvent } from "@/lib/api/response";

describe("security audit logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("apiError emits a structured security warning by default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    apiError("UNAUTHORIZED", "Unauthorized", 401, "req_test", {
      action: "auth",
    });
    expect(warn).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(warn.mock.calls[0][0]));
    expect(payload).toMatchObject({
      event: "security",
      type: "auth_failure",
      request_id: "req_test",
      status: 401,
    });
  });

  it("logSecurityEvent records rate_limit events", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSecurityEvent({
      type: "rate_limit",
      requestId: "req_rl",
      userId: "user_1",
      status: 429,
    });
    const payload = JSON.parse(String(warn.mock.calls[0][0]));
    expect(payload.type).toBe("rate_limit");
    expect(payload.user_id).toBe("user_1");
  });

  it("apiError can skip duplicate logging", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    apiError("RATE_LIMITED", "too many", 429, "req_x", { skipLog: true });
    expect(warn).not.toHaveBeenCalled();
  });
});
