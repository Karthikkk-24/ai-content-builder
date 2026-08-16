export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { assertRequiredEnvAtBoot } = await import("./lib/env");
  assertRequiredEnvAtBoot();
}
