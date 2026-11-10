import {
  Calendar,
  Check,
  Clock,
  DoorOpen,
  Flag,
  HeartPulse,
  Hospital,
  House,
  Info,
  MessageSquare,
  Pill,
  Route,
  Shield,
  Stethoscope,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Lucide has no lungs glyph; this is drawn in the same 24px stroke style. */
export function LungsIcon({ className, strokeWidth = 2, size = 24, ...rest }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide", className)}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 3v9" />
      <path d="M12 12c-1 1.5-2.2 2.2-3.2 2.2" />
      <path d="M12 12c1 1.5 2.2 2.2 3.2 2.2" />
      <path d="M9.5 6.2C7.2 6.2 4 10.5 4 15.4 4 18.6 5.3 20 7.2 20c2.1 0 2.8-1.6 2.8-4V7.4c0-.7-.2-1.2-.5-1.2Z" />
      <path d="M14.5 6.2c2.3 0 5.5 4.3 5.5 9.2 0 3.2-1.3 4.6-3.2 4.6-2.1 0-2.8-1.6-2.8-4V7.4c0-.7.2-1.2.5-1.2Z" />
    </svg>
  );
}

const ICONS: Record<string, LucideIcon | typeof LungsIcon> = {
  hospital: Hospital,
  home: House,
  flag: Flag,
  lungs: LungsIcon,
  shield: Shield,
  check: Check,
  calendar: Calendar,
  pill: Pill,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  info: Info,
  clock: Clock,
  "door-open": DoorOpen,
  route: Route,
  message: MessageSquare,
  question: MessageSquare,
};

export function CareIcon({ iconKey, ...props }: LucideProps & { iconKey: string | null | undefined }) {
  const Icon = ICONS[iconKey ?? ""] ?? Info;
  return <Icon aria-hidden="true" {...props} />;
}
