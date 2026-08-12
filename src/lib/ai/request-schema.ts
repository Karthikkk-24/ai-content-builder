import { z } from "zod";

/** Hard caps for user-influenced AI request fields (DoS / token spend). */
export const MAX_AI_PROMPT_LENGTH = 8_000;
export const MAX_AI_REMARKS_LENGTH = 2_000;
export const MAX_AI_CONTEXT_VALUE_LENGTH = 500;
export const MAX_AI_CONTEXT_KEYS = 20;

export const aiPromptSchema = z.string().min(1).max(MAX_AI_PROMPT_LENGTH);

export const aiRemarksSchema = z.string().max(MAX_AI_REMARKS_LENGTH).optional();

export const aiContextSchema = z
  .record(z.string().max(64), z.string().max(MAX_AI_CONTEXT_VALUE_LENGTH))
  .refine((obj) => Object.keys(obj).length <= MAX_AI_CONTEXT_KEYS, {
    message: `context must have at most ${MAX_AI_CONTEXT_KEYS} keys`,
  })
  .optional();
