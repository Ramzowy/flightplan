import { Hospital, Shield, Users } from "lucide-react";
import { AmberNote, Panel } from "@/components/ui/Card";

const ROWS = [
  { icon: Users, title: "Family & patient", body: "One shared family view, based on validated guardian permissions." },
  { icon: Shield, title: "Private information", body: "Hospital privacy rules still decide what the family view can show." },
  { icon: Hospital, title: "Care team", body: "Staff use approved clinical roles and sessions." },
];

export function WhoCanSeeWhat() {
  return (
    <Panel as="aside" aria-labelledby="who-can-see" className="flex flex-col">
      <h2 id="who-can-see" className="mb-6 text-2xl font-bold">
        Who can see what?
      </h2>
      <ul className="flex flex-col gap-4">
        {ROWS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 rounded-[var(--radius-card)] border border-fp-line p-5">
            <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-fp-teal" />
            <div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="text-fp-subtle">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <AmberNote className="mt-auto pt-6">A detail-level switch never overrides record permissions.</AmberNote>
    </Panel>
  );
}

const DEMO_ACCOUNTS = [
  { email: "family@flightplan.demo", who: "Family & patient" },
  { email: "clinician@flightplan.demo", who: "Care team (demo)" },
];

export function DemoCredentials() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return null;
  return (
    <section
      aria-labelledby="demo-accounts"
      className="rounded-[var(--radius-card)] border border-dashed border-fp-amber/60 p-5"
    >
      <h2 id="demo-accounts" className="text-lg font-semibold text-fp-amber">
        Demo mode — fictional accounts
      </h2>
      <ul className="mt-2 space-y-1 text-fp-subtle">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <span className="font-mono text-fp-text">{a.email}</span> — {a.who}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-fp-subtle">
        Password: <span className="font-mono text-fp-text">FlightPlanDemo1!</span> (demo only)
      </p>
    </section>
  );
}
