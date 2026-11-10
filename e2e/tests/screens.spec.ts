import { expect, test, type Page } from "@playwright/test";
import {
  CLINICIAN_EMAIL,
  FAMILY_EMAIL,
  MAYA_ID,
  RESTRICTED_NOTE,
  demoIds,
  expectNoHorizontalScroll,
  loginToDashboard,
  registerViaUi,
  uniqueEmail,
  type DemoIds,
} from "./helpers";

let ids: DemoIds;

test.beforeAll(async () => {
  ids = await demoIds();
});

const P = `/patients/${MAYA_ID}`;

type Screen = { n: string; path: () => string; expectText: RegExp[] };

const publicScreens: Screen[] = [
  { n: "01 welcome", path: () => "/welcome", expectText: [/FlightPlan/, /email/i] },
  { n: "02 login", path: () => "/login", expectText: [/sign in/i, /password/i] },
  { n: "02 register", path: () => "/register", expectText: [/create|register|sign up/i, /password/i] },
];

const familyScreens: Screen[] = [
  { n: "03 dashboard", path: () => "/dashboard", expectText: [/Maya/, /Right now/i] },
  { n: "04 journey L1", path: () => `${P}/journey`, expectText: [/Hospital stay 1/, /At home/, /Hospital stay 2/] },
  { n: "05 stay L2", path: () => `${P}/journey/${ids.stay2}`, expectText: [/Breathing support/, /Arrival/] },
  { n: "06 breathing L3", path: () => `${P}/journey/${ids.breathing}`, expectText: [/Tube placed/, /Tube removed/] },
  { n: "07 event L4", path: () => `${P}/journey/${ids.tubePlaced}`, expectText: [/What happened\?/] },
  { n: "08 today", path: () => `${P}/today`, expectText: [/Today/, /Keep breathing comfortable/] },
  { n: "09 medications", path: () => `${P}/medications`, expectText: [/Medicine A/, /Medicine C/] },
  { n: "10 procedures", path: () => `${P}/procedures`, expectText: [/Imaging scan|look inside/i, /Airway check/i] },
  { n: "11 safety", path: () => `${P}/safety`, expectText: [/Food and drink/, /Movement and activity/] },
  { n: "12 questions", path: () => `${P}/questions`, expectText: [/Why did Maya need breathing support\?/, /not emergency|not.*urgent/i] },
  { n: "13 rounds", path: () => `${P}/rounds`, expectText: [/Our journey/, /Our questions/] },
  { n: "14 history", path: () => `${P}/history`, expectText: [/Hospital stay 1/, /12 days/] },
  {
    n: "15 home interval",
    path: () => `${P}/history/home/${ids.homeInterval}`,
    expectText: [/12 days/, /faster at night/, /not an established cause/i],
  },
  { n: "17 care path", path: () => `${P}/care-path`, expectText: [/New treatment plan/, /Different care setting/] },
  { n: "18 accessibility", path: () => "/settings/accessibility", expectText: [/Simple/, /Medical terms|Clinical/i] },
];

async function expectTexts(page: Page, texts: RegExp[]) {
  for (const t of texts) await expect(page.getByText(t).first(), `text ${t}`).toBeVisible();
}

for (const s of publicScreens) {
  test(`screen ${s.n}`, async ({ page }) => {
    await page.goto(s.path());
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expectTexts(page, s.expectText);
    await expectNoHorizontalScroll(page);
  });
}

test("family screens 03-15, 17, 18 render with key content", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  for (const s of familyScreens) {
    await test.step(s.n, async () => {
      const resp = await page.goto(s.path());
      expect(resp?.status(), `${s.n} status`).toBeLessThan(400);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expectTexts(page, s.expectText);
      await expect(page.getByText(RESTRICTED_NOTE)).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });
  }
});

test("screen 16: clinician sees the review queue", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await page.goto("/clinician/review");
  await expect(page).toHaveURL(/\/clinician\/review/);
  await page.getByRole("link", { name: /Maya B\./ }).first().click();
  await expect(page.getByRole("heading", { name: /Maya/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /review/i }).first()).toBeVisible();
  await expect(page.getByText(/pending/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /approve/i }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("family is denied the clinician review screen", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto("/clinician/review");
  await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0);
  await expect(page.getByText(RESTRICTED_NOTE)).toHaveCount(0);
  const denied = page
    .getByText(/not (authori[sz]ed|permitted|allowed|available to you)|do(es)? not have access|access denied|care team only|clinicians? only|forbidden/i)
    .first();
  await expect
    .poll(async () => !/\/clinician\/review/.test(page.url()) || (await denied.isVisible()), {
      message: "family should be redirected away or see an access-denied message",
    })
    .toBe(true);
});

test("family nav has no Review tab", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await expect(page.getByRole("link", { name: /^review$/i })).toHaveCount(0);
});

test("adding a question persists after reload", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`${P}/questions`);
  const text = `E2E question ${Date.now()}?`;
  await page.getByRole("textbox").first().fill(text);
  await page.getByRole("button", { name: /save question|add question|save/i }).first().click();
  await expect(page.getByText(text)).toBeVisible();
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
});

test("question text is rendered as text, not HTML", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`${P}/questions`);
  let dialogFired = false;
  page.on("dialog", async (d) => {
    dialogFired = true;
    await d.dismiss();
  });
  const marker = `xss-${Date.now()}`;
  const payload = `<img src=x onerror="alert('${marker}')"> ${marker}`;
  await page.getByRole("textbox").first().fill(payload);
  await page.getByRole("button", { name: /save question|add question|save/i }).first().click();
  await expect(page.getByText(payload)).toBeVisible();
  await page.reload();
  await expect(page.getByText(payload)).toBeVisible();
  expect(dialogFired).toBe(false);
});

test("switching depth to clinical never shows restricted content", async ({ page }) => {
  // A fresh demo-explorer account keeps the shared family user's preferences untouched.
  await registerViaUi(page, uniqueEmail("depth"));
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/settings/accessibility");
  const clinical = page.getByRole("radio", { name: /^Medical terms/i });
  await clinical.check({ force: true });
  await page.getByRole("button", { name: /^save/i }).first().click();
  await expect(page.getByText(/settings saved/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Medical terms/i })).toBeChecked();

  for (const path of [
    `${P}/journey`,
    `${P}/journey/${ids.stay2}`,
    `${P}/journey/${ids.breathing}`,
    `${P}/journey/${ids.tubePlaced}`,
    `${P}/today`,
    `${P}/rounds`,
    `${P}/history`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByText(RESTRICTED_NOTE), path).toHaveCount(0);
  }
});

test("unknown home interval shows a not-found panel", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`${P}/history/home/33333333-3333-4333-8333-333333333333`);
  await expect(page.getByText(/not found|could not find|doesn.t exist|no longer available|not available/i).first()).toBeVisible();
  await expect(page.getByText(/12 days/)).toHaveCount(0);
});

test("unknown home interval id that is not a uuid is handled", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  const resp = await page.goto(`${P}/history/home/not-a-real-id`);
  expect(resp?.status()).toBeLessThan(500);
  await expect(page.getByText(/not found|could not find|doesn.t exist|no longer available|not available|went wrong/i).first()).toBeVisible();
});
