import { z } from "zod";

/**
 * Parse a query `limit` into a safe positive integer within [min, max].
 * Invalid / NaN / negative values fall back to `defaultLimit`.
 */
export function parseLimitParam(
  raw: string | null,
  {
    defaultLimit,
    maxLimit,
    minLimit = 1,
  }: { defaultLimit: number; maxLimit: number; minLimit?: number }
): number {
  const schema = z.coerce
    .number()
    .int()
    .min(minLimit)
    .max(maxLimit)
    .catch(defaultLimit);

  // Empty / missing → default without treating "" as 0.
  if (raw === null || raw.trim() === "") {
    return defaultLimit;
  }

  return schema.parse(raw);
}
