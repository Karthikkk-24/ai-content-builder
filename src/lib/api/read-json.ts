import { apiError, type ApiErrorCode } from "@/lib/api/response";

/** Default JSON body cap for AI generate routes (prompts + URL refs). */
export const AI_JSON_BODY_LIMIT_BYTES = 100_000;

/** Slightly higher cap for project create/update (block arrays). */
export const PROJECT_JSON_BODY_LIMIT_BYTES = 256_000;

/** Clerk user payloads are small; cap public webhook buffering. */
export const WEBHOOK_BODY_LIMIT_BYTES = 256_000;

export type ReadBodyResult =
  | { ok: true; text: string }
  | { ok: false; status: number; code: ApiErrorCode; message: string };

export type ReadJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; code: ApiErrorCode; message: string };

function tooLarge(maxBytes: number): Extract<ReadBodyResult, { ok: false }> {
  return {
    ok: false,
    status: 413,
    code: "INVALID_INPUT",
    message: `Request body too large (max ${maxBytes} bytes)`,
  };
}

/**
 * Read a raw request body with an explicit byte cap.
 * Honors Content-Length when present, then streams so missing/lied lengths
 * cannot force unbounded buffering.
 */
export async function readRawBody(
  req: Request,
  maxBytes: number
): Promise<ReadBodyResult> {
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      contentLength > maxBytes
    ) {
      return tooLarge(maxBytes);
    }
  }

  const reader = req.body?.getReader();
  if (!reader) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Request body is required",
    };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return tooLarge(maxBytes);
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Failed to read request body",
    };
  }

  if (received === 0) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Request body is required",
    };
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder("utf-8").decode(merged) };
}

/**
 * Read and parse a JSON request body with an explicit size limit.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number
): Promise<ReadJsonResult> {
  const raw = await readRawBody(req, maxBytes);
  if (!raw.ok) return raw;

  if (!raw.text.trim()) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      message: "Request body is required",
    };
  }

  try {
    return { ok: true, data: JSON.parse(raw.text) as unknown };
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
