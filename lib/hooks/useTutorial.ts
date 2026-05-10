"use client";

// Tracks the first-run tutorial: whether it's been completed AND which
// step the user is currently on.
//
// Both flags persist to localStorage so navigating across pages doesn't
// reset state. Versioned key suffix (`.v2`) — bump it when the tutorial
// materially changes so returning users see the new content.

import { useCallback, useEffect, useState } from "react";

const DONE_KEY = "drivel.tutorialDone.v2";
const STEP_KEY = "drivel.tutorialStep.v2";

// Custom event the hook fires when localStorage changes — same-tab
// updates don't fire `storage` events, so we synthesize one.
const CHANGE_EVENT = "drivel:tutorial-change";

export function useTutorial() {
  const [done, setDoneState] = useState(false);
  const [step, setStepState] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      setDoneState(window.localStorage.getItem(DONE_KEY) === "1");
      const raw = window.localStorage.getItem(STEP_KEY);
      setStepState(raw ? Math.max(0, parseInt(raw, 10) || 0) : 0);
    };
    read();
    setHydrated(true);
    window.addEventListener(CHANGE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const setStep = useCallback((s: number) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STEP_KEY, String(s));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    setStepState(s);
  }, []);

  const complete = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DONE_KEY, "1");
      window.localStorage.removeItem(STEP_KEY);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    setDoneState(true);
    setStepState(0);
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DONE_KEY);
      window.localStorage.removeItem(STEP_KEY);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    setDoneState(false);
    setStepState(0);
  }, []);

  return { done, step, setStep, hydrated, complete, reset };
}
