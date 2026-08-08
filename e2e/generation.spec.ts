import { expect, test, type Page } from "@playwright/test";

const hasClerkE2E =
  Boolean(process.env.E2E_CLERK_USER_EMAIL) &&
  Boolean(process.env.E2E_CLERK_USER_PASSWORD);

async function mockAiApis(page: Page) {
  await page.route("**/api/ai/generate/photo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        output:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        style: {
          summary: "mock style",
          moodWords: ["soft"],
          dominantColors: ["white"],
          compositionNotes: "center",
        },
      }),
    });
  });

  await page.route("**/api/ai/generate/tweet", async (route) => {
    const body = route.request().postDataJSON() as { stream?: boolean } | null;
    if (body?.stream) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          'data: {"type":"delta","text":"Hello "}\n\n' +
          'data: {"type":"delta","text":"world"}\n\n' +
          'data: {"type":"done","output":"Hello world","provider":"mock"}\n\n',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output: "Hello world" }),
    });
  });

  await page.route("**/api/ai/prompt-upgrade", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enhanced: "An enhanced cinematic prompt about a quiet lake at dawn",
      }),
    });
  });

  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000099",
          title: "E2E Project",
          blocks: [],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/projects/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-4000-8000-000000000099",
        title: "E2E Project",
        blocks: [],
        isPublic: false,
      }),
    });
  });

  await page.route("**/api/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        defaultTone: null,
        defaultGenerationType: null,
        marketingOptOut: false,
        customAvatarUrl: null,
      }),
    });
  });
}

test.describe("authenticated generation flows", () => {
  test.skip(!hasClerkE2E, "Set E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await mockAiApis(page);

    await page.goto("/sign-in");
    await page
      .getByLabel(/email/i)
      .first()
      .fill(process.env.E2E_CLERK_USER_EMAIL!);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(process.env.E2E_CLERK_USER_PASSWORD!);
    await page.getByRole("button", { name: /continue|sign in/i }).first().click();
    await page.waitForURL(/dashboard|generate|builder/, { timeout: 60_000 });
  });

  test("dashboard loads after sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("photo generator mocked happy path", async ({ page }) => {
    await page.goto("/generate/photos");
    await page.getByPlaceholder(/describe what you want/i).fill(
      "a quiet lake at dawn"
    );
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByAltText(/generated/i)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /regenerate/i }).click();
    await expect(page.getByText(/previous/i)).toBeVisible({ timeout: 30_000 });
  });

  test("builder create and save with mocked API", async ({ page }) => {
    await page.goto("/builder");
    await page.getByRole("button", { name: /paragraph/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await page.waitForURL(/\/builder\/00000000-0000-4000-8000-000000000099/);
  });

  test("prompt upgrade mocked flow", async ({ page }) => {
    await page.goto("/generate/prompt-upgrade");
    await page.getByPlaceholder(/describe what you want/i).fill("lake dawn");
    await page.getByRole("button", { name: /upgrade prompt/i }).click();
    await expect(
      page.getByPlaceholder(/describe what you want/i)
    ).toHaveValue(/enhanced cinematic prompt/i);
  });
});
