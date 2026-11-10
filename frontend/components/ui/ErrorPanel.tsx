import { CircleAlert, Lock, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";

export function ErrorPanel({ status: rawStatus, message }: { status: number; message?: string }) {
  // Pages only fetch by id, so a 422 here means a malformed id in the URL: treat it as not found.
  const status = rawStatus === 422 ? 404 : rawStatus;
  const Icon = status === 403 ? Lock : status === 404 ? SearchX : CircleAlert;
  const title =
    status === 403
      ? "This information is not available to you"
      : status === 404
        ? "We could not find that page"
        : "Something went wrong";
  const body =
    status === 403
      ? message ?? "You do not have access to this information. Access is set by the care team, not by detail settings."
      : status === 404
        ? "It may have moved, or it does not belong to this patient."
        : message ?? "Please try again in a moment.";
  return (
    <Panel className="flex flex-col items-start gap-4" role="alert">
      <span className="flex size-14 items-center justify-center rounded-full bg-fp-raised text-fp-teal">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="max-w-2xl text-lg text-fp-subtle">{body}</p>
      <ButtonLink href="/dashboard" variant="secondary">
        Back to home
      </ButtonLink>
    </Panel>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-fp-line p-6 text-fp-subtle">
      <p className="text-lg font-semibold text-fp-text">{title}</p>
      <p className="mt-1">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
