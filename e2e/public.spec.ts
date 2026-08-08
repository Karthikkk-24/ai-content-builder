import { expect, test } from "@playwright/test";

test.describe("public smoke", () => {
  test("liveness health endpoint returns live", async ({ request }) => {
    const res = await request.get("/api/health/live");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("live");
  });

  test("readiness health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health/ready");
    // 200 when DB+Redis ok, 503 when deps unavailable — both are valid probe answers.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body.status === "ready" || body.status === "not_ready").toBeTruthy();
    expect(body.checks?.database).toBeTruthy();
    expect(body.checks?.redis).toBeTruthy();
  });
});

test.describe("public UI", () => {
  // These hit Clerk-backed routes; skip when publishable key is unset (CI without secrets).
  test.skip(
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY required for UI smoke"
  );

  test("marketing landing renders brand CTA", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("link", { name: /get started|sign in/i }).first()
    ).toBeVisible();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.locator("body")).toContainText(/sign in|email|continue/i, {
      timeout: 60_000,
    });
  });

  test("unknown share id is not found", async ({ page }) => {
    const res = await page.goto(
      "/share/00000000-0000-4000-8000-000000000000",
      { waitUntil: "domcontentloaded", timeout: 60_000 }
    );
    expect(res?.status()).toBeGreaterThanOrEqual(400);
  });
});
