"use client";

// Theme hook. Light/dark, persisted in localStorage, with a pre-hydration
// inline script in app/layout.tsx that reads the same key BEFORE React
// paints — that's why there's no light→dark flash on reload.
//
// `hydrated` mirrors useIdentity's pattern so callers can avoid the
// SSR-vs-client mismatch when rendering theme-dependent UI (e.g. the
// sun/moon icon).

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "drivel.theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThemeState(readInitial());
    setHydrated(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = t;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, t);
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle, hydrated };
}
