"use client";

// Sticky top bar with brand mark, theme toggle, and identity chip.
// Follows the Lightbook Lite design.

import Link from "next/link";
import { useTheme } from "@/lib/hooks/useTheme";

type Props = {
  identity: string | null;
  onEditName: () => void;
  /** When true, hides the identity chip (e.g. on the gate screen itself). */
  hideIdentity?: boolean;
};

export default function TopBar({ identity, onEditName, hideIdentity }: Props) {
  const { theme, toggle, hydrated } = useTheme();

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Drivel home">
        <span className="brand__mark">d</span>
        <span className="brand__name">drivel</span>
        <span className="brand__lite">Lite · drivel table</span>
      </Link>
      <div className="topbar__right">
        {/* hydrated-gate the icon swap so SSR/CSR agree on the markup */}
        <button
          type="button"
          data-tut="theme-toggle"
          className="theme-toggle tip"
          data-tip={
            !hydrated
              ? ""
              : theme === "dark"
                ? "Switch to light"
                : "Switch to dark"
          }
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {hydrated && theme === "dark" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
            </svg>
          )}
        </button>
        {identity && !hideIdentity && (
          <span className="identity-chip">
            <span className="identity-chip__dot">{initials(identity)}</span>
            <span>{identity}</span>
            <button onClick={onEditName}>edit</button>
          </span>
        )}
      </div>
    </header>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "·"
  );
}
