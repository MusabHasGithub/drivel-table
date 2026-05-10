"use client";

// Identity hook. Returns the current name (from localStorage), a setter, and
// a `hydrated` flag.
//
// Why `hydrated`: localStorage is unavailable during SSR, so the first render
// has to assume "no name yet" — but if we showed the NameGate based on that
// without the hydrated flag, every page would briefly flash the gate even
// for returning users. With `hydrated`, callers can render nothing (or a
// neutral skeleton) until the client effect runs, then render the real
// state. This avoids a hydration mismatch warning and the visual flash.

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredName,
  getStoredName,
  setStoredName as writeStoredName,
} from "../identity";

export function useIdentity() {
  const [name, setNameState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setNameState(getStoredName());
    setHydrated(true);
  }, []);

  const setName = useCallback((next: string) => {
    writeStoredName(next);
    setNameState(getStoredName());
  }, []);

  const clear = useCallback(() => {
    clearStoredName();
    setNameState(null);
  }, []);

  return { name, setName, clear, hydrated };
}
