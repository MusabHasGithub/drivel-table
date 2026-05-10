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

export default function Home() {
  const { name, setName, hydrated } = useIdentity();
  const [editing, setEditing] = useState(false);

  if (!hydrated) return null;

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
      {/* The interactive tutorial reads its own state via useTutorial
          and only renders if not done. It self-routes to the shared
          tutorial room and detects each feature usage to advance. */}
      <Tutorial />
    </>
  );
}
