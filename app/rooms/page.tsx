"use client";

// One room's table view. Static-export-friendly: the room id arrives via
// `?id=…` query string (since static export can't pre-render a dynamic
// `[roomId]` segment without knowing the values at build time).
//
// Pipeline now runs entirely in the browser:
//   - submitEntry → addDoc → runExtraction → updateDoc per cell
//   - addCategory → reextractRoomCategory → updateDoc per row, per cell
// (No server-side route handlers in this build — see the GH-Pages refactor
// notes in next.config.ts.)

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AddCategoryModal from "@/app/components/AddCategoryModal";
import DrivelInput from "@/app/components/DrivelInput";
import EntryTable from "@/app/components/EntryTable";
import TopBar from "@/app/components/TopBar";
import TrashModal from "@/app/components/TrashModal";
import Tutorial from "@/app/components/Tutorial";
import { useCategories } from "@/lib/hooks/useCategories";
import { useEntries } from "@/lib/hooks/useEntries";
import { useIdentity } from "@/lib/hooks/useIdentity";
import { useRoom } from "@/lib/hooks/useRoom";
import { runExtraction } from "@/lib/entries";
import { METADATA_KEYS } from "@/lib/types";

// `useSearchParams` requires a Suspense boundary in static-export mode.
export default function RoomPageWrapper() {
  return (
    <Suspense fallback={null}>
      <RoomPage />
    </Suspense>
  );
}

function RoomPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("id") ?? "";
  const { name: identity, hydrated: identityHydrated } = useIdentity();
  const [editingName, setEditingName] = useState(false);
  const { room, ready: roomReady, notFound } = useRoom(roomId);
  const { categories, ready: categoriesReady } = useCategories(roomId);
  const { entries, ready: entriesReady } = useEntries(roomId);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const { entries: trashEntries } = useEntries(roomId, { includeDeleted: true });
  const { categories: trashCategories } = useCategories(roomId, { includeDeleted: true });
  const trashCount =
    trashEntries.filter((e) => !!e.deletedAt).length +
    trashCategories.filter((c) => !!c.deletedAt).length;

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

  if (!roomId) {
    return (
      <>
        <TopBar identity={identity} onEditName={() => setEditingName(true)} />
        <main className="page">
          <div className="page__inner">
            <p className="lede">
              Missing room id. <Link href="/" style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 4 }}>Back to rooms</Link>.
            </p>
          </div>
        </main>
      </>
    );
  }

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
                style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 4 }}
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
                style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 4 }}
              >
                ← back to rooms
              </Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  if (editingName) {
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
                Anyone with the link can add drivel. Columns are shared; the extractor fills new ones for old rows automatically.
              </p>
            </div>
            <div className="room-head__stats">
              <div>
                <div className="stat__num">{entriesReady ? entries.length : "·"}</div>
                <span className="stat__lbl">Entries</span>
              </div>
              <div>
                <div className="stat__num">{categoriesReady ? extractableColumnCount : "·"}</div>
                <span className="stat__lbl">Columns</span>
              </div>
              <div>
                <div className="stat__num">{entriesReady ? submitterCount : "·"}</div>
                <span className="stat__lbl">People</span>
              </div>
            </div>
          </div>

          <DrivelInput
            roomId={roomId}
            identity={identity}
            categories={categories}
            onSubmitted={(entryId, drivel) => {
              // Fire-and-forget; cell-level snapshot listener paints results as they land.
              void runExtraction({
                roomId,
                entryId,
                drivel,
                categories,
              }).catch((err) => {
                console.error("[room] runExtraction failed", err);
              });
            }}
          />

          <div className="section-bar">
            <div className="section-bar__title">
              <h2 className="h-section" style={{ fontSize: 22 }}>Entries</h2>
              <span style={{ fontSize: 12, color: "var(--mute)" }}>
                {entriesReady ? `${entries.length} total` : "loading…"}
                {extractingCount > 0 && (
                  <span style={{ marginLeft: 10, color: "var(--extract-fg)" }}>
                    · {extractingCount} cell{extractingCount === 1 ? "" : "s"} extracting
                  </span>
                )}
              </span>
            </div>
            <div className="section-bar__filters">
              <button
                data-tut="trash-button"
                className="btn btn--ghost btn--small"
                onClick={() => setTrashOpen(true)}
                style={{ padding: "6px 8px" }}
              >
                Trash{trashCount > 0 ? ` · ${trashCount}` : ""}
              </button>
              <button
                data-tut="add-column"
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
                <em style={{ color: "var(--accent)", fontStyle: "italic" }}>yet</em>.
              </p>
              <p className="lede" style={{ margin: "10px auto 0", fontSize: 14 }}>
                Paste your first drivel above. As soon as you hit Add, the row appears with{" "}
                <span style={{ color: "var(--extract-fg)" }}>extracting…</span> placeholders that fill in within a second or two.
              </p>
            </div>
          ) : (
            <EntryTable
              roomId={roomId}
              identity={identity}
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

          <TrashModal
            open={trashOpen}
            onClose={() => setTrashOpen(false)}
            roomId={roomId}
          />
        </div>
      </main>
      <Tutorial />
    </>
  );
}

function EditNameOverlay({ onCancel }: { onCancel: () => void }) {
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
