"use client";

// Landing page. Two states:
//   1. Name not set yet (or user clicked "edit name") → render <NameGate>.
//   2. Name set → show the rooms screen.
//
// `hydrated` from useIdentity prevents the NameGate from flashing for
// returning users.

import { useState } from "react";
import NameGate from "./components/NameGate";
import RoomSwitcher from "./components/RoomSwitcher";
import TopBar from "./components/TopBar";
import Tutorial from "./components/Tutorial";
import { useIdentity } from "@/lib/hooks/useIdentity";
import { useTutorial } from "@/lib/hooks/useTutorial";

export default function Home() {
  const { name, setName, hydrated } = useIdentity();
  const { done: tutorialDone, hydrated: tutorialHydrated, complete: completeTutorial } = useTutorial();
  const [editing, setEditing] = useState(false);

  if (!hydrated || !tutorialHydrated) {
    return null; // Avoid SSR/CSR mismatch flash; pre-hydration script handles theme.
  }

  if (!name || editing) {
    return (
      <>
        <TopBar identity={name} onEditName={() => {}} hideIdentity />
        <NameGate
          initialValue={name}
          onSubmit={(next) => {
            setName(next);
            setEditing(false);
          }}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      </>
    );
  }

  return (
    <>
      <TopBar identity={name} onEditName={() => setEditing(true)} />
      <RoomSwitcher identity={name} />
      {/* Unskippable on first run. Once `tutorialDone` is set in
          localStorage it never appears again. Rendered AFTER the page so
          the user can see what's behind it (the room switcher), but the
          scrim + Escape-trap + body-scroll-lock prevents interaction. */}
      {!tutorialDone && (
        <Tutorial identity={name} onComplete={completeTutorial} />
      )}
    </>
  );
}
