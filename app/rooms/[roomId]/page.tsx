"use client";

// One room's table view. Visual: per the Lightbook Lite design — back
// link + italic serif room name + lede + stats panel (entries / columns
// / people) on the right, then composer, then section bar with "+ Column",
// then table.
//
// Behavior unchanged: hooks subscribe to room/categories/entries; submitting
// drivel triggers /api/extract; adding a category triggers /api/reextract-room.

import { use as useResource, useMemo, useState } from "react";
import Link from "next/link";
import AddCategoryModal from "@/app/components/AddCategoryModal";
import DrivelInput from "@/app/components/DrivelInput";
import EntryTable from "@/app/components/EntryTable";
import TopBar from "@/app/components/TopBar";
import { useCategories } from "@/lib/hooks/useCategories";
import { useEntries } from "@/lib/hooks/useEntries";
import { useIdentity } from "@/lib/hooks/useIdentity";
import { useRoom } from "@/lib/hooks/useRoom";
import { METADATA_KEYS } from "@/lib/types";

type Params = { roomId: string };

export default function RoomPage({ params }: { params: Promise<Params> }) {
  const { roomId } = useResource(params);
  const { name: identity, hydrated: identityHydrated } = useIdentity();
  const [editingName, setEditingName] = useState(false);
  const { room, ready: roomReady, notFound } = useRoom(roomId);
  const { categories, ready: categoriesReady } = useCategories(roomId);
  const { entries, ready: entriesReady } = useEntries(roomId);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  // Derived stats for the room header.
  const submitterCount = useMemo(
    () => new Set(entries.map((e) => e.submittedBy)).size,
    [entries],
  );
  const extractableColumnCount = useMemo(
    () => categories.filter((c) => !METADATA_KEYS.has(c.key)).length,
    [categories],
  );
  const extractingCount = useMemo(
    () =>
      entries.reduce(
        (acc, e) =>
          acc +
          Object.values(e.extracted ?? {}).filter(
            (c) => c?.status === "extracting",
          ).length,
        0,
      ),
    [entries],
  );

  if (!identityHydrated) return null;

  if (!identity) {
    return (
      <>
        <TopBar identity={null} onEditName={() => {}} />
        <main className="page">
          <div className="page__inner">
            <p className="lede">
              Set your name on the{" "}
              <Link
                href="/"
                style={{
                  color: "var(--ink)",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                home page
              </Link>{" "}
              first.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <TopBar identity={identity} onEditName={() => setEditingName(true)} />
        <main className="page">
          <div className="page__inner">
            <h1 className="h-section">No room called &ldquo;{roomId}&rdquo;.</h1>
            <p className="lede" style={{ marginTop: 12 }}>
              <Link
                href="/"
                style={{
                  color: "var(--ink)",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                ← back to rooms
              </Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  // Edit-name overlay (re-shows the NameGate). Simpler than a modal.
  if (editingName) {
    // Lazy import — only loads when needed.
    return <EditNameOverlay onCancel={() => setEditingName(false)} />;
  }

  return (
    <>
      <TopBar identity={identity} onEditName={() => setEditingName(true)} />
      <main className="page page--wide">
        <div className="page__inner">
          <div className="room-head">
            <div>
              <Link href="/" className="room-head__back">
                <span>←</span> All rooms
              </Link>
              <h1 className="h-room" style={{ marginTop: 8 }}>
                {roomReady && room ? room.name : "Loading…"}
              </h1>
              <p className="lede" style={{ marginTop: 8, fontSize: 14 }}>
                Anyone with the link can add drivel. Columns are shared; the
                extractor fills new ones for old rows automatically.
              </p>
            </div>
            <div className="room-head__stats">
              <div>
                <div className="stat__num">
                  {entriesReady ? entries.length : "·"}
                </div>
                <span className="stat__lbl">Entries</span>
              </div>
              <div>
                <div className="stat__num">
                  {categoriesReady ? extractableColumnCount : "·"}
                </div>
                <span className="stat__lbl">Columns</span>
              </div>
              <div>
                <div className="stat__num">
                  {entriesReady ? submitterCount : "·"}
                </div>
                <span className="stat__lbl">People</span>
              </div>
            </div>
          </div>

          <DrivelInput
            roomId={roomId}
            identity={identity}
            categories={categories}
            onSubmitted={(entryId, drivel) => {
              void fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  roomId,
                  entryId,
                  drivel,
                  categories: categories.map((c) => ({
                    key: c.key,
                    label: c.label,
                    description: c.description,
                    type: c.type,
                  })),
                }),
              }).catch((err) => {
                console.error("[room] /api/extract POST failed", err);
              });
            }}
          />

          <div className="section-bar">
            <div className="section-bar__title">
              <h2 className="h-section" style={{ fontSize: 22 }}>
                Entries
              </h2>
              <span style={{ fontSize: 12, color: "var(--mute)" }}>
                {entriesReady ? `${entries.length} total` : "loading…"}
                {extractingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 10,
                      color: "var(--extract-fg)",
                    }}
                  >
                    · {extractingCount} cell
                    {extractingCount === 1 ? "" : "s"} extracting
                  </span>
                )}
              </span>
            </div>
            <div className="section-bar__filters">
              <button
                className="btn btn--quiet btn--small"
                onClick={() => setAddColumnOpen(true)}
              >
                + Column
              </button>
            </div>
          </div>

          {!categoriesReady || !entriesReady ? (
            <p style={{ fontSize: 14, color: "var(--mute)" }}>Loading…</p>
          ) : entries.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--rule-strong)",
                borderRadius: 16,
                padding: "60px 24px",
                textAlign: "center",
                background: "var(--card)",
              }}
            >
              <p className="h-section" style={{ fontSize: 26 }}>
                No entries{" "}
                <em
                  style={{
                    color: "var(--accent)",
                    fontStyle: "italic",
                  }}
                >
                  yet
                </em>
                .
              </p>
              <p
                className="lede"
                style={{ margin: "10px auto 0", fontSize: 14 }}
              >
                Paste your first drivel above. As soon as you hit Add, the
                row appears with{" "}
                <span style={{ color: "var(--extract-fg)" }}>
                  extracting…
                </span>{" "}
                placeholders that fill in within a second or two.
              </p>
            </div>
          ) : (
            <EntryTable
              roomId={roomId}
              categories={categories}
              entries={entries}
              onAddColumn={() => setAddColumnOpen(true)}
            />
          )}

          <AddCategoryModal
            open={addColumnOpen}
            onClose={() => setAddColumnOpen(false)}
            roomId={roomId}
            identity={identity}
          />
        </div>
      </main>
    </>
  );
}

// Tiny inline overlay so editing your name from a room reuses the same
// NameGate. We could route to /, but that loses the URL — this lets the
// user cancel and stay in their room.
function EditNameOverlay({ onCancel }: { onCancel: () => void }) {
  // Dynamic import not strictly necessary; just re-using the existing component.
  const NameGateMod =
    require("@/app/components/NameGate").default as typeof import("@/app/components/NameGate").default;
  const { name, setName } = useIdentity();
  return (
    <>
      <TopBar identity={name} onEditName={() => {}} hideIdentity />
      <NameGateMod
        initialValue={name}
        onSubmit={(next) => {
          setName(next);
          onCancel();
        }}
        onCancel={onCancel}
      />
    </>
  );
}
