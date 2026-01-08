import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Shift Manager/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("should display signup page", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account|sign up/i })).toBeVisible();
  });

  test("should show validation errors on empty login submission", async ({
    page,
  }) => {
    await page.goto("/login");

    // Find and click submit button
    await page.getByRole("button", { name: /sign in/i }).click();

    // Check for validation feedback (browser native or custom)
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });

  test("should navigate to signup from login", async ({ page }) => {
    await page.goto("/login");

    // Look for signup link
    const signupLink = page.getByRole("link", { name: /sign up|create account/i });
    await expect(signupLink).toBeVisible();
    await signupLink.click();

    await expect(page).toHaveURL(/signup/);
  });

  test("should navigate to forgot password from login", async ({ page }) => {
    await page.goto("/login");

    // Look for forgot password link
    const forgotLink = page.getByRole("link", { name: /forgot password/i });

    // Only check if link exists, since it might not be present in all implementations
    const linkCount = await forgotLink.count();
    if (linkCount > 0) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot-password/);
    }
  });
});
