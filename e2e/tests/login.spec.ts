import { expect, test } from "@playwright/test";
import { FAMILY_EMAIL, login, loginToDashboard, registerViaUi, uniqueEmail } from "./helpers";

test.describe("local email/password access", () => {
  test("family login lands on dashboard", async ({ page }) => {
    await loginToDashboard(page, FAMILY_EMAIL);
    await expect(page.getByText(/Maya/).first()).toBeVisible();
    await expect(page.getByText(/Right now/i).first()).toBeVisible();
  });

  test("session cookie is HttpOnly and not readable by page JS", async ({ page, context }) => {
    await loginToDashboard(page, FAMILY_EMAIL);
    const cookie = (await context.cookies()).find((c) => c.name === "fp_session");
    expect(cookie, "fp_session cookie set").toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("fp_session");
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await login(page, FAMILY_EMAIL, "Not-the-password-1");
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected route redirects to login when signed out", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register a new account and see fictional Maya", async ({ page }) => {
    await registerViaUi(page, uniqueEmail("register"));
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Maya/).first()).toBeVisible();
    await expect(page.getByText(/Leo/)).toHaveCount(0);
  });

  test("register form offers no clinician role", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("option", { name: /clinician|care team/i })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /clinician/i })).toHaveCount(0);
  });

  test("logout ends the session", async ({ page }) => {
    await loginToDashboard(page, FAMILY_EMAIL);
    await page.getByRole("button", { name: /sign out|log out/i }).or(page.getByRole("link", { name: /sign out|log out/i })).first().click();
    await expect(page).toHaveURL(/\/(welcome|login)/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
