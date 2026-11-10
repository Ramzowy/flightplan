import { expect, test } from "@playwright/test";
import { FAMILY_EMAIL, breadcrumbs, clickable, demoIds, loginToDashboard, MAYA_ID, type DemoIds } from "./helpers";

let ids: DemoIds;

test.beforeAll(async () => {
  ids = await demoIds();
});

const journeyUrl = (nodeId?: string) =>
  new RegExp(`/patients/${MAYA_ID}/journey${nodeId ? `/${nodeId}` : ""}/?(\\?.*)?$`);

test("dashboard -> L1 -> L2 -> L3 -> L4, breadcrumbs and back", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);

  // Level 1
  await clickable(page, /journey/i).click();
  await expect(page).toHaveURL(journeyUrl());
  await expect(page.getByText(/Hospital stay 1/).first()).toBeVisible();
  await expect(page.getByText(/At home/).first()).toBeVisible();
  await expect(page.getByText(/Next steps/).first()).toBeVisible();

  // Level 2
  await clickable(page, /Hospital stay 2/i).click();
  await expect(page).toHaveURL(journeyUrl(ids.stay2));
  await expect(clickable(page, /Breathing support/i)).toBeVisible();
  await expect(page.getByText(/Arrival/).first()).toBeVisible();

  // Level 3
  await clickable(page, /Breathing support/i).click();
  await expect(page).toHaveURL(journeyUrl(ids.breathing));
  await expect(clickable(page, /Tube placed/i)).toBeVisible();
  await expect(page.getByText(/Tube removed/).first()).toBeVisible();

  // Level 4
  await clickable(page, /Tube placed/i).click();
  await expect(page).toHaveURL(journeyUrl(ids.tubePlaced));
  await expect(page.getByText(/What happened\?/).first()).toBeVisible();
  await expect(
    page.getByText(/intubation/i).or(page.getByRole("button", { name: /medical term/i })).first(),
  ).toBeVisible();

  // Breadcrumbs go up exactly one level at a time.
  const crumbs = breadcrumbs(page);
  await expect(crumbs).toBeVisible();
  // The "Back to …" control goes exactly one level up.
  await crumbs.getByRole("link", { name: /^Back to Breathing support$/i }).click();
  await expect(page).toHaveURL(journeyUrl(ids.breathing));
  await breadcrumbs(page).getByRole("link", { name: "Hospital stay 2", exact: true }).click();
  await expect(page).toHaveURL(journeyUrl(ids.stay2));
  await breadcrumbs(page).getByRole("link", { name: /^(My Care Journey|All journeys)$/ }).click();
  await expect(page).toHaveURL(journeyUrl());

  // Browser back retraces the same steps.
  await page.goBack();
  await expect(page).toHaveURL(journeyUrl(ids.stay2));
  await page.goBack();
  await expect(page).toHaveURL(journeyUrl(ids.breathing));
  await page.goBack();
  await expect(page).toHaveURL(journeyUrl(ids.tubePlaced));
  await expect(page.getByText(/What happened\?/).first()).toBeVisible();
});

test("current breadcrumb item is marked aria-current", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/journey/${ids.tubePlaced}`);
  await expect(breadcrumbs(page).locator('[aria-current="page"]')).toContainText(/Tube placed/i);
});

test("current checkpoint is labelled in text, not only colour", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/journey`);
  await expect(page.getByText(/\b(now|current|you are here|in progress)\b/i).first()).toBeVisible();
});

test("node from wrong patient path is not shown", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  const resp = await page.goto(`/patients/${MAYA_ID}/journey/11111111-1111-4111-8111-111111111111`);
  if (resp?.status() === 404) return;
  await expect(
    page.getByText(/not found|could not find|doesn.t exist|no longer available|not available/i).first(),
  ).toBeVisible();
});
