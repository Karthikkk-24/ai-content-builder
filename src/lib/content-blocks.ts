import { z } from "zod";

/** Max blocks per project (DoS / storage bound). */
export const MAX_PROJECT_BLOCKS = 100;

export const MAX_BLOCK_CONTENT_LENGTH = 20_000;
export const MAX_BLOCK_URL_LENGTH = 2_000;
export const MAX_BLOCK_ID_LENGTH = 64;
export const MAX_PROJECT_TITLE_LENGTH = 200;

/**
 * Image/CTA URLs must be empty (unset in the builder) or http(s).
 * Rejects javascript:/data:/etc. XSS vectors in rendered share pages.
 */
export const blockUrlSchema = z
  .string()
  .max(MAX_BLOCK_URL_LENGTH)
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must be empty or an http(s) URL" }
  );

const blockIdSchema = z.string().min(1).max(MAX_BLOCK_ID_LENGTH);
const blockContentSchema = z.string().max(MAX_BLOCK_CONTENT_LENGTH);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: blockIdSchema,
    type: z.literal("heading"),
    content: blockContentSchema,
    level: z.number().int().min(1).max(6).optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal("paragraph"),
    content: blockContentSchema,
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal("divider"),
    content: blockContentSchema,
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal("image"),
    content: blockContentSchema,
    url: blockUrlSchema.optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal("cta"),
    content: blockContentSchema,
    url: blockUrlSchema.optional(),
  }),
]);

export const projectBlocksSchema = z
  .array(contentBlockSchema)
  .max(MAX_PROJECT_BLOCKS);

export const projectTitleSchema = z.string().max(MAX_PROJECT_TITLE_LENGTH);
