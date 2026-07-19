import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "AI_FAILED";

export function createRequestId() {
  return `req_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function getRequestId(req: Request) {
  return req.headers.get("x-request-id") || createRequestId();
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string
) {
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
