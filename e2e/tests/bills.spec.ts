import { expect, test } from "@playwright/test";
import { CLINICIAN_EMAIL, FAMILY_EMAIL, MAYA_ID, expectNoHorizontalScroll, loginToDashboard } from "./helpers";

const DEMO_NOTICE = "Demo amounts — fictional, not real prices or a real bill.";
const CARE_TEAM_FORBIDDEN = "Bills are handled by the hospital billing office and are not shown to the care team.";
// CONTRACT §10.4: format cents with Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}) -> "$1,650.00".
const DUE_NOW = "$1,650"; // whole-dollar amounts are shown without cents
const DEDUCTIBLE_HELP =
  /The amount your family pays for covered care each plan year before insurance starts sharing the cost\./;
const BILLS_URL = `/patients/${MAYA_ID}/bills`;

test("family opens the Bills tab and sees what is due", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/today`);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bills", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(BILLS_URL));
  await expect(page.getByRole("heading", { name: "Bills & costs" }).first()).toBeVisible();
  await expect(page.getByText("What each stay cost, what insurance covers, and what you may owe.").first()).toBeVisible();
  await expect(page.getByText(DEMO_NOTICE).first()).toBeVisible();

  const summary = page.getByRole("list", { name: "Summary" });
  const dueNow = summary.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Due now" }) });
  await expect(dueNow.getByText(DUE_NOW, { exact: true })).toBeVisible();
  await expect(dueNow.getByText(/Nov 19/)).toBeVisible();
  const thisStay = summary.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "This stay so far" }) });
  await expect(thisStay.getByText(/\$1,850(\.00)?/)).toBeVisible();
  await expect(thisStay.getByText(/Estimate — waiting for insurance/)).toBeVisible();
  const rest = summary.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Rest of this stay" }) });
  await expect(rest.getByText(/^\$0(\.00)?$/)).toBeVisible();
  await expect(rest.getByText(/going home Oct 27/)).toBeVisible();

  // Insurance card, statement line and the prospective list.
  const insurance = page.getByRole("region", { name: "Insurance", exact: true });
  await expect(insurance.getByText("Demo Family Health Plan (fictional)", { exact: false })).toBeVisible();
  await expect(insurance.getByText(/\$1,500(\.00)? of \$1,500(\.00)? met/)).toBeVisible();
  await expect(insurance.getByText(/\$2,150(\.00)? of \$4,000(\.00)?/)).toBeVisible();
  await expect(insurance.getByText(/You pay 20% after the deductible/)).toBeVisible();
  const stay1 = page.getByRole("region", { name: "Hospital stay 1", exact: true });
  await expect(stay1.getByText(/Statement issued Oct 20/)).toBeVisible();
  await expect(stay1.getByText(/due Nov 19/)).toBeVisible();
  await expect(stay1.getByText("Billed").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Hospital stay 2", exact: true }).getByText("Waiting for insurance").first()).toBeVisible();
  const comingUp = page.getByRole("region", { name: /Coming up/ });
  await expect(comingUp.getByText(/Imaging scan · Possible — not decided yet/)).toBeVisible();
  await expect(comingUp.getByText(/Going home · Estimate — if things go well/)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("Pay online is disabled and nothing asks for card details", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(BILLS_URL);
  const pay = page.getByRole("button", { name: /Pay online/ });
  await expect(pay).toBeVisible();
  await expect(pay).toBeDisabled();
  await expect(page.getByText(/Available when your hospital connects its billing system/).first()).toBeVisible();
  await expect(page.getByText("(555) 010-0199").first()).toBeVisible();
  await expect(page.getByLabel(/card number|cvv|cvc|expiry|bank account|routing/i)).toHaveCount(0);
  await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
});

test("'What does this mean?' disclosure explains the term", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(BILLS_URL);
  const insurance = page.getByRole("region", { name: "Insurance", exact: true });
  const help = insurance.getByText(DEDUCTIBLE_HELP);
  await expect(help).toBeHidden();
  await insurance.getByText("What does this mean?").first().click();
  await expect(help).toBeVisible();
  await insurance.getByText("What does this mean?").first().click();
  await expect(help).toBeHidden();
});

test("family asks a billing question; it persists and stays off the clinical questions", async ({ page }, testInfo) => {
  const text = `E2E billing question ${testInfo.project.name} ${Date.now().toString(36)}`;
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(BILLS_URL);
  await expect(page.getByText("Is the follow-up clinic visit covered too?").first()).toBeVisible();
  await page.getByLabel("Your question for the billing office").fill(text);
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText(/Saved. This demo does not send questions/).first()).toBeVisible();
  await page.reload();
  const list = page.getByRole("region", { name: "Your billing questions" });
  await expect(list.getByText(text)).toBeVisible();
  await expect(list.getByText(/Not sent in this demo/).first()).toBeVisible();

  await page.goto(`/patients/${MAYA_ID}/questions`);
  await expect(page.getByText(/Why did Maya need breathing support\?/).first()).toBeVisible();
  await expect(page.getByText(text)).toHaveCount(0);
  await page.goto(`/patients/${MAYA_ID}/rounds`);
  await expect(page.getByText(text)).toHaveCount(0);
});

test("'Ask about this charge' pre-fills the question form", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(BILLS_URL);
  await page.getByRole("link", { name: "Ask about this charge: Airway procedure" }).click();
  await expect(page).toHaveURL(/[?&]ask=/);
  await expect(page.getByLabel("Your question for the billing office")).toHaveValue(/Airway procedure/);
  await expect(page.getByText(/About this charge:/).first()).toBeVisible();
});

test("family dashboard links to bills; Ahead shows the rest-of-stay cost", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  const line = page.getByRole("link", { name: /Bills: \$1,650(\.00)? due Nov 19/ });
  await expect(line).toBeVisible();
  await page.goto(`/patients/${MAYA_ID}/outlook`);
  const cost = page.getByRole("link", { name: /Estimated cost of the rest of this stay/ });
  await expect(cost).toContainText(/\$0(\.00)? for your family/);
  await cost.click();
  await expect(page).toHaveURL(new RegExp(BILLS_URL));
});

test("care team has no Bills tab and the bills URL shows the billing-office message", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await expect(page.getByText(/Bills: \$/)).toHaveCount(0);
  await page.goto(`/patients/${MAYA_ID}/today`);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Ahead", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Bills", exact: true })).toHaveCount(0);
  await expect(nav.getByText("Bills", { exact: true })).toHaveCount(0);

  await page.goto(BILLS_URL);
  await expect(page.getByText(CARE_TEAM_FORBIDDEN).first()).toBeVisible();
  await expect(page.getByText(/\$1,650/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pay online/ })).toHaveCount(0);

  await page.goto(`/clinician/patients/${MAYA_ID}`);
  await expect(page.getByRole("heading", { name: /Outlook — set expectations/ })).toBeVisible();
  await expect(page.getByText(/\$1,650|Bills & costs/)).toHaveCount(0);
});
