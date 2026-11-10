import { expect, test, type Browser, type Page } from "@playwright/test";
import { CLINICIAN_EMAIL, FAMILY_EMAIL, MAYA_ID, apiAs, expectNoHorizontalScroll, loginToDashboard } from "./helpers";

const DRAFT = /Lung specialist referral/;
const DISCLAIMER = /Estimates can change\. The care team will update this page if the plan changes\./;
const DRAFT_CHIP = /Draft — family can.t see this/;

async function asUser(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginToDashboard(page, email);
  return page;
}

/** Remove milestones this test created, so the shared demo stays tidy. */
async function deleteMilestonesContaining(marker: string) {
  const api = await apiAs(CLINICIAN_EMAIL);
  try {
    const o = await (await api.get(`/api/v1/clinician/patients/${MAYA_ID}/outlook`)).json();
    const all = [o.discharge, ...o.next_24h, ...o.upcoming, ...o.after_discharge].filter(Boolean) as {
      id: string;
      title: string;
    }[];
    for (const m of all.filter((x) => x.title.includes(marker))) {
      await api.delete(`/api/v1/clinician/outlook/milestones/${m.id}`);
    }
  } finally {
    await api.dispose();
  }
}

function roadAheadMap(page: Page) {
  return page.getByRole("list", { name: /road ahead/i });
}

test("family opens the Ahead tab and sees the going-home estimate", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/today`);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Ahead", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${MAYA_ID}/outlook`));
  await expect(page.getByRole("heading", { name: "Looking ahead" }).first()).toBeVisible();
  await expect(page.getByText("What the care team expects next. Estimates can change.").first()).toBeVisible();

  const hero = page.getByRole("region", { name: /^Going home$/ }).first();
  await expect(hero.getByText("Tue, Oct 27")).toBeVisible();
  await expect(hero.getByText(/around 3:00 PM UTC/)).toBeVisible();
  await expect(hero.getByText(/Between Oct 27 and Oct 28/)).toBeVisible();
  await expect(hero.getByText("Estimate — if things go well").first()).toBeVisible();
  await expect(hero.getByText("Day 9 of this stay")).toBeVisible();
  await expect(hero.getByText(/Set by Dr\. Sam Rivera/)).toBeVisible();
  await expect(hero.getByRole("heading", { name: "What needs to happen first" })).toBeVisible();
  await expect(hero.getByText("1 of 5 done")).toBeVisible();
  await expect(hero.getByText("Eating and drinking normally")).toBeVisible();
  // Status in words, never colour alone.
  await expect(hero.getByText("Done", { exact: true }).first()).toBeVisible();
  await expect(hero.getByText("In progress", { exact: true }).first()).toBeVisible();
  await expect(hero.getByText("Not yet", { exact: true }).first()).toBeVisible();

  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  for (const heading of ["In the next 24 hours", "Coming up", "After going home"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Clinic check-up after going home").first()).toBeVisible();
  await expect(page.getByText(DRAFT)).toHaveCount(0);
  await expect(page.getByText(DRAFT_CHIP)).toHaveCount(0);
  // No percentages or countdowns.
  await expect(page.getByText(/\d+\s?%/)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("family dashboard shows the Looking-ahead card linking to Ahead", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  const card = page.getByRole("link", { name: /Looking ahead/i }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Going home: estimated Tue, Oct 27");
  await expect(card).toContainText("if things go well");
  await expect(card).toContainText("1 of 5 steps done");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/patients/${MAYA_ID}/outlook`));
  await expect(page.getByRole("heading", { name: "Looking ahead" }).first()).toBeVisible();
});

test("selecting a stop on the forward map shows its detail", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/outlook`);
  const map = roadAheadMap(page);
  await expect(map.getByRole("link", { name: /^Today,/ })).toBeVisible();
  await expect(map.getByRole("link", { name: /^Going home,/ })).toBeVisible();
  await expect(map.getByRole("link", { name: DRAFT })).toHaveCount(0);

  await map.getByRole("link", { name: /^Imaging scan,/ }).click();
  await expect(page).toHaveURL(/[?&]m=/);
  const detail = page.getByRole("region", { name: "Imaging scan" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("A scan is planned; the time is not booked yet.")).toBeVisible();
  await expect(detail.getByText("Possible — not decided yet").first()).toBeVisible();
  await expect(detail.getByRole("heading", { name: "When" })).toBeVisible();

  await detail.getByRole("link", { name: "Close details" }).click();
  await expect(page.getByRole("region", { name: "Imaging scan" })).toHaveCount(0);
});

test("today lists what is coming up in the next 24 hours", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/today`);
  await expect(page.getByText(/Coming up in the next 24 hours/i).first()).toBeVisible();
  await expect(page.getByText("Team review of overnight breathing").first()).toBeVisible();
  await expect(page.getByText(DRAFT)).toHaveCount(0);
});

test("journey Next steps shows the outlook hint", async ({ page }) => {
  await loginToDashboard(page, FAMILY_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/journey`);
  await expect(page.getByText("Going home: estimated Oct 27 · if things go well").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /See what.s ahead/i }).first()).toBeVisible();
});

test("clinician workspace shows the Outlook panel with the unshared draft", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await page.goto(`/clinician/patients/${MAYA_ID}`);
  const panel = page.getByRole("region", { name: /Outlook — set expectations for the family/ });
  await expect(panel).toBeVisible();
  const draft = panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name: DRAFT }) });
  await expect(draft).toBeVisible();
  await expect(draft.getByText(DRAFT_CHIP)).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Going home", exact: true })).toBeVisible();
  await expect(panel.getByText("Shared with family").first()).toBeVisible();
  await expect(panel.getByRole("button", { name: /Add a milestone/ })).toBeVisible();
});

test("clinician sees the draft on the Ahead page, marked as a draft", async ({ page }) => {
  await loginToDashboard(page, CLINICIAN_EMAIL);
  await page.goto(`/patients/${MAYA_ID}/outlook`);
  await expect(page.getByRole("heading", { name: "Looking ahead" }).first()).toBeVisible();
  // The family-facing page is shared-only for everyone; the draft lives in the workspace.
  await expect(page.getByText(DRAFT)).toHaveCount(0);
});

test("clinician adds a shared milestone, family sees it, clinician deletes it", async ({ browser }, testInfo) => {
  const marker = `e2e-${testInfo.project.name}-${Date.now().toString(36)}`;
  const title = `QA practise ${marker}`;
  try {
    const clin = await asUser(browser, CLINICIAN_EMAIL);
    await clin.goto(`/clinician/patients/${MAYA_ID}`);
    const panel = clin.getByRole("region", { name: /Outlook — set expectations for the family/ });
    await panel.getByRole("button", { name: /Add a milestone/ }).click();
    const form = panel.locator("form").filter({ has: clin.getByRole("button", { name: "Add milestone" }) });
    await form.getByLabel("Kind").selectOption("CARE_STEP");
    await form.getByLabel(/^Certainty/).selectOption("LIKELY");
    await form.getByLabel("Title", { exact: true }).fill(title);
    await form.getByLabel("Summary for the family").fill("A fictional e2e step.");
    await form.getByLabel("Expected date").fill("2026-10-25");
    await form.getByLabel("Time (optional)").fill("10:30");
    await form.getByRole("checkbox", { name: /Share with family/ }).check();
    await form.getByRole("button", { name: "Add milestone" }).click();
    const card = panel.getByRole("listitem").filter({ has: clin.getByRole("heading", { name: title }) });
    await expect(card).toBeVisible();
    await expect(card.getByText("Shared with family")).toBeVisible();
    await expect(card.getByText(DRAFT_CHIP)).toHaveCount(0);

    const fam = await asUser(browser, FAMILY_EMAIL);
    await fam.goto(`/patients/${MAYA_ID}/outlook`);
    const comingUp = fam.getByRole("region", { name: "Coming up", exact: true });
    await expect(comingUp.getByText(title)).toBeVisible();
    await expect(comingUp.getByText(/Oct 25, around 10:30 AM UTC/).first()).toBeVisible();
    await expect(roadAheadMap(fam).getByRole("link", { name: new RegExp(title) })).toBeVisible();

    clin.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: /^Delete$/ }).click();
    await expect(panel.getByRole("heading", { name: title })).toHaveCount(0);
    await clin.context().close();

    await fam.reload();
    await expect(fam.getByText(title)).toHaveCount(0);
    await fam.context().close();
  } finally {
    await deleteMilestonesContaining(marker);
  }
});

test("clinician condition toggle is reflected for the family", async ({ browser }, testInfo) => {
  // Done through the API on a throwaway milestone so the seeded going-home steps stay untouched.
  const marker = `e2e-cond-${testInfo.project.name}-${Date.now().toString(36)}`;
  const api = await apiAs(CLINICIAN_EMAIL);
  try {
    const r = await api.post(`/api/v1/clinician/patients/${MAYA_ID}/outlook/milestones`, {
      data: {
        kind: "CARE_STEP",
        title: marker,
        expected_at: "2026-10-26T09:00:00Z",
        time_known: true,
        certainty: "LIKELY",
        shared_with_family: true,
        conditions: [
          { label: "First QA step", status: "DONE" },
          { label: "Second QA step", status: "NOT_YET" },
        ],
      },
    });
    expect(r.status()).toBe(201);
    const m = await r.json();
    const fam = await asUser(browser, FAMILY_EMAIL);
    await fam.goto(`/patients/${MAYA_ID}/outlook?m=${m.id}`);
    const detail = fam.getByRole("region", { name: marker });
    await expect(detail.getByText("1 of 2 done")).toBeVisible();

    const second = m.conditions.find((c: { label: string }) => c.label === "Second QA step");
    expect((await api.patch(`/api/v1/clinician/outlook/conditions/${second.id}`, { data: { status: "DONE" } })).status()).toBe(200);
    await fam.reload();
    await expect(fam.getByRole("region", { name: marker }).getByText("2 of 2 done")).toBeVisible();
    await fam.context().close();
  } finally {
    await api.dispose();
    await deleteMilestonesContaining(marker);
  }
});
