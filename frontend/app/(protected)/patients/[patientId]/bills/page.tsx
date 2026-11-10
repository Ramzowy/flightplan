import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleHelp, CreditCard, FileText, Phone, ReceiptText, ShieldCheck, TriangleAlert } from "lucide-react";
import { BillingQuestionForm } from "@/components/billing/BillingQuestionForm";
import { Screen } from "@/components/layout/Screen";
import { Panel } from "@/components/ui/Card";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { DEMO_NOTICE, PAY_ONLINE_NOTE, TERM_HELP, billDay, billDayYear, billStatus, money } from "@/lib/billing";
import { load } from "@/lib/load";
import type { BillItem, Billing, BillingStay } from "@/lib/schema";
import { cn, formatDate, pickParam } from "@/lib/utils";
import { getBilling } from "@/services/billing";

export const metadata: Metadata = { title: "Bills & costs" };

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Bills & costs";
const SUBTITLE = "What each stay cost, what insurance covers, and what you may owe.";

function itemLabel(item: BillItem) {
  const day = billDay(item.service_date);
  return `${item.description}${day ? ` (${day})` : ""}`;
}

function DemoNotice({ text }: { text?: string | null }) {
  return (
    <p
      role="note"
      className="flex items-start gap-3 rounded-[var(--radius-card)] border border-fp-amber/60 bg-fp-panel px-4 py-3 text-base font-semibold text-fp-amber sm:px-5"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>{text || DEMO_NOTICE}</span>
    </p>
  );
}

function SummaryCard({
  title,
  amount,
  detail,
  chip,
  link,
}: {
  title: string;
  amount: string;
  detail: string;
  chip?: { label: string; tone: Parameters<typeof StatusChip>[0]["tone"] };
  link?: { href: string; label: string };
}) {
  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
      <h2 className="text-lg font-bold text-fp-muted">{title}</h2>
      <p className="text-4xl font-extrabold tracking-tight">{amount}</p>
      <p className="text-base">{detail}</p>
      {chip ? <StatusChip tone={chip.tone} className="w-fit">{chip.label}</StatusChip> : null}
      {link ? (
        <Link href={link.href} className="mt-auto inline-flex min-h-11 w-fit items-center gap-1 font-semibold text-[#0f6f69] hover:underline">
          {link.label} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </li>
  );
}

function Term({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="rounded-xl bg-white/70 p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-fp-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <details className="mt-1 group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-[#0f6f69] [&::-webkit-details-marker]:hidden">
          <CircleHelp aria-hidden="true" className="size-4" /> What does this mean?
        </summary>
        <p className="mt-1 text-fp-muted">{help}</p>
      </details>
    </div>
  );
}

function Amounts({ item }: { item: BillItem }) {
  const rows = [
    { k: "Charged", v: money(item.charged_cents) },
    { k: "Insurance expected", v: item.insurance_expected_cents == null ? "Not known yet" : money(item.insurance_expected_cents) },
    { k: "Your share", v: item.family_share_cents == null ? "Not known yet" : money(item.family_share_cents) },
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-2 sm:block">
          <dt className="text-sm text-fp-muted">{r.k}</dt>
          <dd className="font-bold">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ItemRow({ item, askHref }: { item: BillItem; askHref: string }) {
  const st = billStatus(item.status, item.status_label);
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-white/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold">{item.description}</p>
          {item.service_date ? <p className="text-sm text-fp-muted">{billDay(item.service_date)}</p> : null}
        </div>
        <StatusChip tone={st.tone}>{st.label}</StatusChip>
      </div>
      <Amounts item={item} />
      {item.family_paid_cents > 0 ? <p className="text-sm text-fp-muted">You paid {money(item.family_paid_cents)}.</p> : null}
      {item.estimate_note ? <p className="text-sm text-fp-muted">{item.estimate_note}</p> : null}
      <Link
        href={askHref}
        aria-label={`Ask about this charge: ${item.description}`}
        className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-[#0f6f69] hover:underline"
      >
        <CircleHelp aria-hidden="true" className="size-4" /> Ask about this charge
      </Link>
    </li>
  );
}

function groupByCategory(items: BillItem[]) {
  const groups: { label: string; items: BillItem[] }[] = [];
  for (const it of items) {
    const label = it.category_label || it.category;
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

function statementLine(stay: BillingStay): string | null {
  const s = stay.statement;
  if (!s) return null;
  if (s.status === "NOT_YET_ISSUED" || !s.issued_on) {
    return `Statement not issued yet · your share is an estimate of ${money(s.amount_cents)}`;
  }
  const due = s.amount_cents - s.paid_cents;
  const parts = [`Statement issued ${billDay(s.issued_on)}`, money(s.amount_cents), `${money(s.paid_cents)} paid`];
  if (s.status === "PAID" || due <= 0) parts.push("paid in full");
  else parts.push(`${money(due)} due${s.due_on ? ` ${billDay(s.due_on)}` : ""}`);
  return parts.join(" · ");
}

function StaySection({ stay, askHref }: { stay: BillingStay; askHref: (i: BillItem) => string }) {
  const headingId = `stay-${stay.encounter_id ?? stay.label.replace(/\W+/g, "-")}`;
  const st = stay.status_label ? { label: stay.status_label, tone: billStatus(stay.items[0]?.status ?? "", stay.status_label).tone } : null;
  const line = statementLine(stay);
  return (
    <Panel aria-labelledby={headingId}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-2xl font-bold sm:text-3xl">
            {stay.label}
          </h2>
          {stay.dates ? <p className="mt-1 text-lg text-fp-subtle">{stay.dates}</p> : null}
        </div>
        {st ? (
          <StatusChip tone={st.tone} size="md">
            {st.label}
          </StatusChip>
        ) : null}
      </div>
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Charged", v: money(stay.charged_cents) },
          { k: "Insurance expected", v: stay.insurance_expected_cents == null ? "Not known yet" : money(stay.insurance_expected_cents) },
          { k: "Your share", v: stay.family_share_cents == null ? "Not known yet" : money(stay.family_share_cents) },
          { k: "You paid", v: money(stay.family_paid_cents) },
        ].map((r) => (
          <div key={r.k} className="rounded-xl bg-fp-panel p-3">
            <dt className="text-sm text-fp-subtle">{r.k}</dt>
            <dd className="text-xl font-bold">{r.v}</dd>
          </div>
        ))}
      </dl>
      {line ? (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-fp-line px-4 py-3 text-base">
          <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fp-teal" />
          <span>{line}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink sm:p-5">
        {groupByCategory(stay.items).map((g) => (
          <section key={g.label} aria-label={`${stay.label}: ${g.label}`}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-fp-muted">{g.label}</h3>
            <ul className="flex flex-col gap-2">
              {g.items.map((it) => (
                <ItemRow key={it.id} item={it} askHref={askHref(it)} />
              ))}
            </ul>
          </section>
        ))}
        {stay.items.length === 0 ? <p className="text-fp-muted">No charges listed for this stay yet.</p> : null}
      </div>
    </Panel>
  );
}

function restOfStayDetail(b: Billing): string {
  const home = b.upcoming.find((i) => i.milestone && /going home/i.test(i.milestone.title) && i.milestone.expected_at);
  const day = home?.milestone ? billDay(home.milestone.expected_at) : null;
  return day ? `Estimate if going home ${day}` : "Estimate from the billing office";
}

export default async function BillsPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const askId = pickParam((await searchParams).ask) ?? null;
  const result = await load(() => getBilling(patientId));
  const base = `/patients/${encodeURIComponent(patientId)}`;

  if (!result.ok) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }

  const b = result.data;
  const s = b.summary;
  const allItems = [...b.stays.flatMap((x) => x.items), ...b.upcoming];
  const askItem = askId ? allItems.find((i) => i.id === askId) : undefined;
  const askHref = (i: BillItem) => `${base}/bills?ask=${encodeURIComponent(i.id)}#billing-help`;
  const cov = b.coverage;
  const help = b.help;
  const phone = help?.billing_office_phone ?? "(555) 010-0199";

  return (
    <Screen title={TITLE} subtitle={SUBTITLE}>
      <DemoNotice text={b.demo_notice} />

      <ul className="grid gap-4 md:grid-cols-3" aria-label="Summary">
        <SummaryCard
          title="Due now"
          amount={money(s.owed_now_cents)}
          detail={
            s.owed_now_cents > 0
              ? s.next_due_on
                ? `Due ${billDayYear(s.next_due_on)}`
                : "Due now"
              : "Nothing is due right now."
          }
          chip={s.owed_now_cents > 0 ? { label: "Billed", tone: "restricted" } : undefined}
        />
        <SummaryCard
          title="This stay so far"
          amount={money(s.pending_family_estimate_cents ?? 0)}
          detail="Your share, as estimated by the billing office."
          chip={{ label: "Estimate — waiting for insurance", tone: "planned" }}
        />
        <SummaryCard
          title="Rest of this stay"
          amount={money(s.upcoming_family_estimate_cents ?? 0)}
          detail={restOfStayDetail(b)}
          chip={{ label: "Estimate", tone: "estimate" }}
          link={{ href: `${base}/outlook`, label: "See what's ahead" }}
        />
      </ul>

      {cov ? (
        <section
          aria-labelledby="insurance-heading"
          className="rounded-[var(--radius-card)] bg-fp-info-strong p-5 text-fp-ink sm:p-7"
        >
          <div className="flex flex-wrap items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-1 size-7 shrink-0 text-[#13a79e]" />
            <div className="min-w-0 flex-1">
              <h2 id="insurance-heading" className="text-2xl font-bold">
                Insurance
              </h2>
              <p className="text-lg text-fp-muted">
                {cov.plan_name}
                {cov.plan_year_end ? ` · plan year ends ${billDayYear(cov.plan_year_end)}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Term
              label="Deductible"
              value={`${money(cov.deductible_met_cents)} of ${money(cov.deductible_cents)} met`}
              help={TERM_HELP.deductible}
            />
            <Term
              label="Out-of-pocket"
              value={`${money(cov.out_of_pocket_met_cents)} of ${money(cov.out_of_pocket_max_cents)}`}
              help={TERM_HELP.outOfPocket}
            />
            <Term
              label="Coinsurance"
              value={`You pay ${cov.coinsurance_percent}% after the deductible`}
              help={TERM_HELP.coinsurance}
            />
          </div>
        </section>
      ) : (
        <p className="text-fp-subtle">No insurance details have been shared by the billing office.</p>
      )}

      {b.stays.map((stay) => (
        <StaySection key={stay.encounter_id ?? stay.label} stay={stay} askHref={askHref} />
      ))}

      <Panel aria-labelledby="bills-coming-up">
        <h2 id="bills-coming-up" className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <CalendarClock aria-hidden="true" className="size-7 text-fp-teal" /> Coming up
        </h2>
        <p className="mt-1 text-lg text-fp-subtle">
          Estimates from the billing office for care that has not happened yet. If the plan or dates change, these change.
        </p>
        {b.upcoming.length === 0 ? (
          <p className="mt-4 text-fp-subtle">No upcoming cost estimates have been shared.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {b.upcoming.map((it) => {
              const st = billStatus(it.status, it.status_label);
              return (
                <li key={it.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{it.description}</p>
                      {it.milestone ? (
                        <Link
                          href={`${base}/outlook?m=${encodeURIComponent(it.milestone.id)}#outlook-detail`}
                          className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#0f6f69] hover:underline"
                        >
                          {it.milestone.title}
                          {it.milestone.certainty_label ? ` · ${it.milestone.certainty_label}` : ""}
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                      ) : null}
                    </div>
                    <StatusChip tone={st.tone}>{st.label}</StatusChip>
                  </div>
                  <Amounts item={it} />
                  {it.estimate_note ? <p className="text-sm text-fp-muted">{it.estimate_note}</p> : null}
                  <Link
                    href={askHref(it)}
                    aria-label={`Ask about this charge: ${it.description}`}
                    className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-[#0f6f69] hover:underline"
                  >
                    <CircleHelp aria-hidden="true" className="size-4" /> Ask about this charge
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel aria-labelledby="billing-help-heading" id="billing-help" className="scroll-mt-6">
        <h2 id="billing-help-heading" className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ReceiptText aria-hidden="true" className="size-7 text-fp-teal" /> Help with bills
        </h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] bg-fp-raised p-5">
              <button
                type="button"
                disabled
                aria-describedby="pay-online-note"
                className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-full border border-fp-line px-6 font-semibold text-fp-subtle opacity-70"
              >
                <CreditCard aria-hidden="true" className="size-5" /> Pay online
              </button>
              <p id="pay-online-note" className="mt-2 text-fp-subtle">
                {PAY_ONLINE_NOTE} FlightPlan never asks for card or bank details.
              </p>
            </div>
            {help?.payment_plans ? (
              <div>
                <h3 className="text-lg font-bold">Payment plans</h3>
                <p className="mt-1 text-fp-subtle">{help.payment_plans}</p>
              </div>
            ) : null}
            {help?.financial_assistance ? (
              <div>
                <h3 className="text-lg font-bold">Financial assistance</h3>
                <p className="mt-1 text-fp-subtle">{help.financial_assistance}</p>
              </div>
            ) : null}
            <p className="flex flex-wrap items-center gap-2 text-lg">
              <Phone aria-hidden="true" className="size-5 text-fp-teal" /> Billing office (fictional):
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center font-bold text-fp-teal underline-offset-4 hover:underline">
                {phone}
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink">
              <BillingQuestionForm
                patientId={patientId}
                item={askItem ? { id: askItem.id, label: itemLabel(askItem) } : null}
                clearHref={`${base}/bills#billing-help`}
              />
            </div>
            <section aria-labelledby="billing-questions-heading">
              <h3 id="billing-questions-heading" className="text-lg font-bold">
                Your billing questions
              </h3>
              {b.questions.length === 0 ? (
                <p className="mt-1 text-fp-subtle">No billing questions saved yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {b.questions.map((q) => (
                    <li key={q.id} className={cn("rounded-xl border border-fp-line bg-fp-panel p-3")}>
                      <p className="text-base">{q.text}</p>
                      <p className="text-sm text-fp-subtle">
                        {q.author_display_name ?? "Family member"} · {formatDate(q.created_at)} · Not sent in this demo
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </Panel>

      <DemoNotice text={b.demo_notice} />
    </Screen>
  );
}
