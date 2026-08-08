export type SseEvent =
  | { type: "delta"; text: string }
  | { type: "done"; output: string; provider: string }
  | { type: "error"; message: string };

export function encodeSse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseResponse(
  stream: ReadableStream<Uint8Array>,
  requestId: string
): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": requestId,
      "x-accel-buffering": "no",
    },
  });
}
