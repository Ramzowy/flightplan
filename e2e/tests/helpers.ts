import { expect, request, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "FlightPlanDemo1!";
export const FAMILY_EMAIL = "family@flightplan.demo";
export const CLINICIAN_EMAIL = "clinician@flightplan.demo";
export const MAYA_ID = "00000000-0000-4000-8000-000000000001";
export const RESTRICTED_NOTE = /Restricted clinical note/i;

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@qa.flightplan.demo`;
}

/** A clickable checkpoint/link/button whose accessible name matches. */
export function clickable(page: Page, name: RegExp): Locator {
  return page.getByRole("link", { name }).or(page.getByRole("button", { name })).first();
}

export function breadcrumbs(page: Page): Locator {
  return page.getByRole("navigation", { name: /breadcrumb/i });
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).click();
}

export async function loginToDashboard(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function registerViaUi(page: Page, email: string, password = "Sturdy-pass-9"): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/name/i).first().fill("E2E Explorer");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill(password);
  const confirm = page.getByLabel(/confirm/i);
  if (await confirm.count()) await confirm.fill(password);
  await page.getByRole("button", { name: /create account|register|sign up/i }).click();
}

// ---------------------------------------------------------------- direct API access (ids, setup)

export async function apiAs(email: string, password = DEMO_PASSWORD): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: API_URL });
  const r = await anon.post("/api/v1/auth/login", { data: { email, password } });
  expect(r.status(), `API login ${email}`).toBe(200);
  const { token } = await r.json();
  await anon.dispose();
  return request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

type NodeRef = { id: string; title: string; children: NodeRef[] };

async function node(api: APIRequestContext, id?: string): Promise<NodeRef> {
  const r = await api.get(`/api/v1/patients/${MAYA_ID}/journey${id ? `/${id}` : ""}`);
  expect(r.status()).toBe(200);
  return r.json();
}

function child(n: NodeRef, re: RegExp): NodeRef {
  const c = n.children.find((x) => re.test(x.title));
  if (!c) throw new Error(`No child ${re} under ${n.title}: ${n.children.map((x) => x.title).join(", ")}`);
  return c;
}

export type DemoIds = { stay2: string; breathing: string; tubePlaced: string; homeInterval: string };

export async function demoIds(): Promise<DemoIds> {
  const api = await apiAs(FAMILY_EMAIL);
  try {
    const root = await node(api);
    const stay2 = await node(api, child(root, /hospital stay 2/i).id);
    const breathing = await node(api, child(stay2, /breathing support/i).id);
    const tubePlaced = child(breathing, /tube placed/i).id;
    const intervals = await (await api.get(`/api/v1/patients/${MAYA_ID}/home-intervals`)).json();
    return { stay2: stay2.id, breathing: breathing.id, tubePlaced, homeInterval: intervals[0].id };
  } finally {
    await api.dispose();
  }
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}
