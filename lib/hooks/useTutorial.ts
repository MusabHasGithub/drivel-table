"use client";

// Tracks whether the user has finished the first-run tutorial.
//
// Stored per-device in localStorage. Mirrors useIdentity's `hydrated`
// pattern so callers can avoid the brief flicker where SSR thinks the
// tutorial isn't done yet.
//
// Why localStorage and not Firestore: the tutorial is about UX
// onboarding, which is per-browser. A user opening the app fresh on a
// new device is genuinely a "first-time user" of that device and seeing
// the tutorial again is fine.

import { useCallback, useEffect, useState } from "react";

const KEY = "drivel.tutorialDone.v1";
// Bump the suffix (`.v2`, `.v3`) when the tutorial materially changes —
// returning users will see the new content without us tracking versions.

export function useTutorial() {
  const [done, setDoneState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDoneState(window.localStorage.getItem(KEY) === "1");
    setHydrated(true);
  }, []);

  const complete = useCallback(() => {
    setDoneState(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, "1");
    }
  }, []);

  // Exposed for "watch tutorial again" later, plus useful in dev.
  const reset = useCallback(() => {
    setDoneState(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(KEY);
    }
  }, []);

  return { done, hydrated, complete, reset };
}
