import { z } from "zod";

const requiredSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().startsWith("sk_"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
});

type RequiredEnv = z.infer<typeof requiredSchema>;

let validated: RequiredEnv | null = null;

export function validateEnv(): RequiredEnv {
  if (validated) return validated;

  const result = requiredSchema
    .extend({
      DATABASE_URL: requiredSchema.shape.DATABASE_URL.refine(
        (val) => val.startsWith("postgres://") || val.startsWith("postgresql://"),
        { message: "DATABASE_URL must be a postgres connection string" }
      ),
    })
    .safeParse(process.env);

  if (!result.success) {
    const failures = result.error.flatten().fieldErrors;
    const missing = Object.keys(failures).join(", ");
    throw new Error(`Environment validation failed for: ${missing}`);
  }

  validated = result.data;
  return validated;
}

/** Tests only: clear the memoized successful parse. */
export function __resetEnvValidationForTests(): void {
  validated = null;
}

/**
 * Call once at server boot (`instrumentation.ts`). Production fails closed;
 * local/dev/e2e log and continue so Playwright can exercise public routes.
 */
export function assertRequiredEnvAtBoot(): void {
  try {
    validateEnv();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.warn(
      "Environment validation failed (non-production):",
      error instanceof Error ? error.message : error
    );
  }
}

export function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const env = {
  get databaseUrl() {
    validateEnv();
    return process.env.DATABASE_URL!;
  },
  get clerkSecretKey() {
    validateEnv();
    return process.env.CLERK_SECRET_KEY!;
  },
  get googleAiKey() {
    validateEnv();
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
  },
  get groqApiKey() {
    return optionalEnv("GROQ_API_KEY");
  },
  get uploadthingToken() {
    return optionalEnv("UPLOADTHING_TOKEN");
  },
  get upstashRedisRestUrl() {
    return optionalEnv("UPSTASH_REDIS_REST_URL");
  },
  get upstashRedisRestToken() {
    return optionalEnv("UPSTASH_REDIS_REST_TOKEN");
  },
};
