import { expect, test, type Browser, type Page } from "@playwright/test";
import { CLINICIAN_EMAIL, FAMILY_EMAIL, MAYA_ID, apiAs, demoIds, loginToDashboard, type DemoIds } from "./helpers";

const LEO_ID = "00000000-0000-4000-8000-000000000002";
const AVA_ID = "00000000-0000-4000-8000-000000000003";
const SEEDED_PRIVATE = /Confirm the schedule for Medicine B/;
const SEEDED_SHARED_SCAN = /The scan time is not set yet/;

let ids: DemoIds;

test.beforeAll(async () => {
  ids = await demoIds();
});

async function asUser(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginToDashboard(page, email);
  return page;
}

/** Remove notes this test created, so the shared demo stays tidy. */
async function deleteNotesContaining(marker: string) {
  const api = await apiAs(CLINICIAN_EMAIL);
  try {
    const notes: { id: string; text: string }[] = await (
      await api.get(`/api/v1/clinician/patients/${MAYA_ID}/notes`)
    ).json();
    for (const n of notes.filter((x) => x.text.includes(marker))) {
      await api.delete(`/api/v1/clinician/notes/${n.id}`);
    }
  } finally {
    await api.dispose();
  }
}

async function addNote(page: Page, targetLabel: RegExp, text: string, shared: boolean) {
  const section = page.getByRole("region", { name: new RegExp(`Care-team notes about ${targetLabel.source}`, "i") }).first();
  await section.getByRole("button", { name: /^Add note about/i }).click();
  await section.getByLabel(/Care-team note about/i).fill(text);
  const share = section.getByRole("checkbox", { name: /Share with family/i });
  if (shared) await share.check();
  else await expect(share).not.toBeChecked();
  await section.getByRole("button", { name: /^Save note$/ }).click();
  await expect(page.getByText(text)).toBeVisible();
}

test("clinician dashboard lists three patients and opens a workspace", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await expect(page.getByRole("heading", { name: /Your patients/i })).toBeVisible();
  for (const name of [/Maya B\./, /Leo R\./, /Ava K\./]) {
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  }
  await page.getByRole("link", { name: /Ava K\./ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/clinician/patients/${AVA_ID}`));
  await expect(page.getByRole("heading", { name: /Ava/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Add a general note/i })).toBeVisible();
  await expect(page.getByText(/Care team access/i).first()).toBeVisible();
});

test("clinician workspace for Maya shows notes with visibility chips", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await page.goto(`/clinician/patients/${MAYA_ID}`);
  await expect(page.getByText(SEEDED_PRIVATE).first()).toBeVisible();
  await expect(page.getByText(SEEDED_SHARED_SCAN).first()).toBeVisible();
  await expect(page.getByText("Care team only").first()).toBeVisible();
  await expect(page.getByText("Shared with family").first()).toBeVisible();
  await expect(page.getByText(/Why did Maya need breathing support\?/).first()).toBeVisible();
});

test("family cannot open clinician workspaces", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  for (const pid of [MAYA_ID, LEO_ID, AVA_ID]) {
    await page.goto(`/clinician/patients/${pid}`);
    await expect(page.getByRole("heading", { name: /Add a general note/i })).toHaveCount(0);
    await expect(page.getByText(SEEDED_PRIVATE)).toHaveCount(0);
    await expect(page.getByText(/not available to you|do not have access|not (authori[sz]ed|permitted)/i).first()).toBeVisible();
  }
});

test("family cannot open Leo or Ava pages", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  for (const pid of [LEO_ID, AVA_ID]) {
    await page.goto(`/patients/${pid}/journey`);
    await expect(page.getByText(/not available to you|do not have access|not (authori[sz]ed|permitted)/i).first()).toBeVisible();
    await expect(page.getByText(/Ava K\.|Leo R\./)).toHaveCount(0);
  }
});

test("shared note on a journey node reaches the family; care-team-only note does not", async ({ browser }, testInfo) => {
  const marker = `e2e-${testInfo.project.name}-${Date.now().toString(36)}`;
  const sharedText = `Shared clarification ${marker}`;
  const privateText = `Care team only clarification ${marker}`;
  try {
    const clin = await asUser(browser, CLINICIAN_EMAIL);
    await clin.goto(`/patients/${MAYA_ID}/journey/${ids.tubePlaced}`);
    await addNote(clin, /Tube placed/, sharedText, true);
    await addNote(clin, /Tube placed/, privateText, false);
    await clin.reload();
    await expect(clin.getByText(sharedText)).toBeVisible();
    await expect(clin.getByText(privateText)).toBeVisible();
    await clin.context().close();

    const fam = await asUser(browser, FAMILY_EMAIL);
    await fam.goto(`/patients/${MAYA_ID}/journey/${ids.tubePlaced}`);
    await expect(fam.getByText(sharedText)).toBeVisible();
    await expect(fam.getByText("Note from your care team").first()).toBeVisible();
    await expect(fam.getByText(privateText)).toHaveCount(0);
    await expect(fam.getByRole("button", { name: /^Add note/i })).toHaveCount(0);
    await expect(fam.getByText("Care team only")).toHaveCount(0);
    await fam.context().close();
  } finally {
    await deleteNotesContaining(marker);
  }
});

test("family medicines and procedures pages show only shared notes", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/medications`);
  await expect(page.getByText(/Medicine B/).first()).toBeVisible();
  await expect(page.getByText(SEEDED_PRIVATE)).toHaveCount(0);
  await page.goto(`/patients/${MAYA_ID}/procedures`);
  await expect(page.getByText(SEEDED_SHARED_SCAN).first()).toBeVisible();
  await expect(page.getByText("Note from your care team").first()).toBeVisible();
});

test("clinician sees the care-team-only medicine note", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/medications`);
  // Notes show in the detail panel for the selected medicine.
  await page.getByRole("link", { name: /Medicine B/ }).first().click();
  await expect(page.getByText(SEEDED_PRIVATE).first()).toBeVisible();
  await expect(page.getByText("Care team only").first()).toBeVisible();
});
