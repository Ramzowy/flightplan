import { SCREEN_COUNT } from "@/lib/design-tokens";

/**
 * One wireframe screen: page title + subtitle, the content, and the
 * "fictional patient" footer with the screen number.
 */
export function Screen({
  title,
  subtitle,
  screen,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  screen?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-2 mb-4 sm:mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-fp-text sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-base text-fp-subtle sm:text-lg">{subtitle}</p> : null}
      </div>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
      <ScreenFooter screen={screen} />
    </div>
  );
}

export function ScreenFooter({ screen }: { screen?: number }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-fp-subtle sm:text-sm">
      <p>
        <span className="font-medium tracking-wide">FICTIONAL PATIENT • DEMO DATA</span> • Not connected to a hospital
        record
      </p>
      {screen ? (
        <p aria-label={`Screen ${screen} of ${SCREEN_COUNT}`}>
          {String(screen).padStart(2, "0")} / {SCREEN_COUNT}
        </p>
      ) : null}
    </footer>
  );
}
