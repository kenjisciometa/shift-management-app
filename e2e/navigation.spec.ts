import { test, expect } from "@playwright/test";

test.describe("Navigation (unauthenticated)", () => {
  test("should redirect to login when accessing protected routes", async ({
    page,
  }) => {
    // Try to access dashboard
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing schedule", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing time clock", async ({
    page,
  }) => {
    await page.goto("/time-clock");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing PTO", async ({ page }) => {
    await page.goto("/pto");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing chat", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Public pages", () => {
  test("should allow access to login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("should allow access to signup page", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /create account|sign up/i })
    ).toBeVisible();
  });
});
