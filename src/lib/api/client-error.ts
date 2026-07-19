export function getApiErrorMessage(
  data: unknown,
  fallback: string
): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const payload = data as {
    error?: string | { message?: string };
  };

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.error && typeof payload.error === "object" && payload.error.message) {
    return payload.error.message;
  }

  return fallback;
}
