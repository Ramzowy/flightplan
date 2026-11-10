import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Big rounded inner panel (the dark raised area inside the shell). */
export function Panel({
  children,
  className,
  as: Tag = "section",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "aside" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn("rounded-[var(--radius-panel)] border border-fp-line bg-fp-soft p-5 sm:p-8", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeading({
  title,
  subtitle,
  level = 2,
  action,
  id,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  level?: 2 | 3;
  action?: React.ReactNode;
  id?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <H id={id} className={cn("font-bold text-fp-text", level === 2 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl")}>
          {title}
        </H>
        {subtitle ? <p className="mt-2 text-base text-fp-subtle sm:text-lg">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Pale-blue information card with dark ink text. */
export function InfoCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section";
}) {
  return (
    <Tag className={cn("rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6", className)}>{children}</Tag>
  );
}

/** Icon bubble used on the left of cards. */
export function IconBubble({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark" | "teal";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full",
        tone === "light" && "bg-white/70 text-fp-teal [&_svg]:text-[#19b5ac]",
        tone === "dark" && "bg-fp-raised text-fp-teal",
        tone === "teal" && "bg-fp-teal text-fp-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Amber cautionary note. Text carries the meaning; icon is decorative. */
export function AmberNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-sm font-medium text-fp-amber sm:text-base", className)}>
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center justify-center rounded-full bg-fp-raised px-5 py-1.5 text-sm font-semibold text-fp-teal",
        className,
      )}
    >
      {children}
    </span>
  );
}
