import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "AI_FAILED";

export type SecurityEventType =
  | "auth_failure"
  | "rate_limit"
  | "invalid_input"
  | "not_found"
  | "ai_failure"
  | "webhook_failure"
  | "internal_error";

export function createRequestId() {
  return `req_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function getRequestId(req: Request) {
  return req.headers.get("x-request-id") || createRequestId();
}

function codeToSecurityEvent(code: ApiErrorCode): SecurityEventType {
  switch (code) {
    case "UNAUTHORIZED":
      return "auth_failure";
    case "RATE_LIMITED":
      return "rate_limit";
    case "INVALID_INPUT":
      return "invalid_input";
    case "NOT_FOUND":
      return "not_found";
    case "AI_FAILED":
      return "ai_failure";
    default:
      return "internal_error";
  }
}

/**
 * Structured security / audit log for failures and sensitive events.
 * Emits JSON to stdout for platform log drains (Vercel/Datadog/etc.).
 */
export function logSecurityEvent(params: {
  type: SecurityEventType;
  requestId: string;
  userId?: string | null;
  action?: string;
  reason?: string;
  status?: number;
  detail?: string;
}) {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "WARN",
      service: "ai-content-builder",
      event: "security",
      type: params.type,
      request_id: params.requestId,
      user_id: params.userId ?? null,
      action: params.action ?? null,
      reason: params.reason ?? null,
      status: params.status ?? null,
      detail: params.detail ?? null,
    })
  );
}

export type ApiErrorContext = {
  userId?: string | null;
  action?: string;
  detail?: string;
  /** Set true only when the caller already emitted a security log. */
  skipLog?: boolean;
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string,
  context?: ApiErrorContext
) {
  if (!context?.skipLog) {
    logSecurityEvent({
      type: codeToSecurityEvent(code),
      requestId,
      userId: context?.userId,
      action: context?.action,
      reason: message,
      status,
      detail: context?.detail ?? code,
    });
  }

  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    {
      status,
      headers: {
        "x-request-id": requestId,
      },
    }
  );
}

export function apiSuccess<T>(
  data: T,
  requestId: string,
  init?: { status?: number }
) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "x-request-id": requestId,
    },
  });
}

export function logAction(params: {
  requestId: string;
  action: string;
  userId?: string;
  outcome: "success" | "failure";
  resource?: string;
  detail?: string;
}) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      service: "ai-content-builder",
      request_id: params.requestId,
      action: params.action,
      user_id: params.userId ?? null,
      resource: params.resource ?? null,
      outcome: params.outcome,
      detail: params.detail ?? null,
    })
  );
}
