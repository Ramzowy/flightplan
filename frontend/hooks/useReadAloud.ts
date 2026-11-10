"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Read text aloud with the browser's built-in Web Speech API.
 * Speech is generated locally by the browser; FlightPlan sends nothing anywhere.
 */
export function useReadAloud() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, lang = "en-US") => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  return { supported, speaking, speak, stop };
}
