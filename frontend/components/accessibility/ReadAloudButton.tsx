"use client";

import { Square, Volume2 } from "lucide-react";
import { useReadAloud } from "@/hooks/useReadAloud";
import { cn } from "@/lib/utils";

export function ReadAloudButton({ text, className }: { text: string; className?: string }) {
  const { supported, speaking, speak, stop } = useReadAloud();
  if (!supported) {
    return (
      <p className={cn("text-sm text-fp-muted", className)}>Read aloud is not available in this browser.</p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-fp-ink/20 bg-white px-5 text-sm font-semibold text-fp-ink hover:bg-white/80",
        className,
      )}
    >
      {speaking ? <Square aria-hidden="true" className="size-4" /> : <Volume2 aria-hidden="true" className="size-5" />}
      {speaking ? "Stop reading" : "Read to me"}
    </button>
  );
}
