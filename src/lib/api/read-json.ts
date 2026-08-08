import { apiError, type ApiErrorCode } from "@/lib/api/response";

/** Default JSON body cap for AI generate routes (prompts + URL refs). */
export const AI_JSON_BODY_LIMIT_BYTES = 100_000;

/** Slightly higher cap for project create/update (block arrays). */
export const PROJECT_JSON_BODY_LIMIT_BYTES = 256_000;

export type ReadJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; code: ApiErrorCode; message: string };

/**
 * Read and parse a JSON request body with an explicit size limit.
 * Checks Content-Length when present, then enforces against the raw body length.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number
): Promise<ReadJsonResult> {
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      contentLength > maxBytes
    ) {
      return {
        ok: false,
        status: 413,
        code: "INVALID_INPUT",
        message: `Request body too large (max ${maxBytes} bytes)`,
      };
    }
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Failed to read request body",
    };
  }

  if (text.length > maxBytes) {
    return {
      ok: false,
      status: 413,
      code: "INVALID_INPUT",
      message: `Request body too large (max ${maxBytes} bytes)`,
    };
  }

  if (!text.trim()) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Request body is required",
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Invalid JSON",
    };
  }
}

export function jsonBodyErrorResponse(
  result: Extract<ReadJsonResult, { ok: false }>,
  requestId: string
) {
  return apiError(result.code, result.message, result.status, requestId);
}
