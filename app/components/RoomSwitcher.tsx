"use client";

// "Your rooms." screen — editorial display heading + dashed new-room
// composer + 2-col grid of room cards. Each card has a hover-revealed
// trash icon for soft-delete; a "Trash" link below the list shows
// deleted rooms so they can be restored.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "./ConfirmModal";
import { useRooms } from "@/lib/hooks/useRooms";
import {
  createRoom,
  deleteRoom,
  restoreRoom,
  RoomCreateError,
} from "@/lib/rooms";
import type { Room } from "@/lib/types";

type Props = { identity: string };

function relativeTime(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function RoomSwitcher({ identity }: Props) {
  const router = useRouter();
  const { rooms, ready, configured } = useRooms();
  const { rooms: allRooms } = useRooms({ includeDeleted: true });
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  const deletedRooms = allRooms.filter((r) => !!r.deletedAt);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitting) return;
    setSubmitting(true);
    try {
      const slug = await createRoom(draft, identity);
      setDraft("");
      router.push(`/rooms/?id=${slug}`);
    } catch (err) {
      if (err instanceof RoomCreateError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Couldn't create room — check the console for details.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <main className="page">
        <div className="page__inner">
          <p className="eyebrow">Setup</p>
          <h1 className="h-display" style={{ marginTop: 12 }}>
            Firebase isn&apos;t <em>configured</em> yet.
          </h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Copy <code>.env.local.example</code> to <code>.env.local</code>{" "}
            and paste your Firebase web SDK config. The dev server will
            hot-reload once you save.
          </p>
        </div>
      </main>
    );
  }

  const sorted = [...rooms].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="page">
      <div className="page__inner">
        <p className="eyebrow">Hi, {identity.split(/\s/)[0]}</p>
        <h1 className="h-display" style={{ marginTop: 12 }}>
          Your <em>rooms</em>.
        </h1>
        <p className="lede" style={{ marginTop: 14 }}>
          Each room is its own table — different people, different
          columns. Share the link and anyone with it can add drivel.
        </p>

        <form
          className="new-room"
          style={{ marginTop: 36 }}
          onSubmit={handleCreate}
        >
          <input
            className="input"
            placeholder="New room — e.g. “Wedding guests”, “Lisbon trip”, “Work people”…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
          />
          <button
            className="btn btn--primary"
            disabled={submitting || draft.trim().length === 0}
          >
            {submitting ? "Creating…" : "Create room"}
          </button>
        </form>

        {error && (
          <p
            style={{
              color: "var(--error-fg)",
              fontSize: 13,
              marginTop: 10,
            }}
          >
            {error}
          </p>
        )}

        <div className="section-bar" style={{ marginTop: 40 }}>
          <div className="section-bar__title">
            <span className="eyebrow">Rooms</span>
            <span style={{ fontSize: 12, color: "var(--mute)" }}>
              {ready ? `${sorted.length} total` : "loading…"}
            </span>
          </div>
          <div className="section-bar__filters">
            <button
              className="btn btn--ghost btn--small"
              onClick={() => setTrashOpen(true)}
              style={{ padding: "6px 8px" }}
            >
              Trash{deletedRooms.length > 0 ? ` · ${deletedRooms.length}` : ""}
            </button>
          </div>
        </div>

        {!ready ? (
          <p style={{ fontSize: 14, color: "var(--mute)", marginTop: 8 }}>
            Loading…
          </p>
        ) : sorted.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--rule-strong)",
              borderRadius: 16,
              padding: "40px 24px",
              textAlign: "center",
              background: "var(--card)",
            }}
          >
            <p className="h-section" style={{ fontSize: 22 }}>
              No rooms <em style={{ color: "var(--accent)" }}>yet</em>.
            </p>
            <p className="lede" style={{ margin: "8px auto 0", fontSize: 14 }}>
              Make one above to get started.
            </p>
          </div>
        ) : (
          <div className="rooms">
            {sorted.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                onDelete={() => setPendingDelete(r)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title={
          pendingDelete
            ? `Delete room "${pendingDelete.name}"?`
            : "Delete room?"
        }
        body="It moves to Trash with all its entries and columns. You can restore it from there. Nothing is actually wiped."
        confirmLabel="Delete room"
        destructive
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteRoom({
            roomId: pendingDelete.id,
            deletedBy: identity,
          });
        }}
      />

      <RoomTrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        deletedRooms={deletedRooms}
      />
    </main>
  );
}

function RoomCard({
  room,
  onDelete,
}: {
  room: Room;
  onDelete: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="room-card"
      style={{ position: "relative" }}
      onClick={() => router.push(`/rooms/?id=${room.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/rooms/?id=${room.slug}`);
        }
      }}
    >
      <span
        className="row-actions"
        style={{ position: "absolute", top: 12, right: 12 }}
      >
        <button
          type="button"
          className="icon-btn tip"
          data-tip="Delete room"
          aria-label="Delete room"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon />
        </button>
      </span>
      <div>
        <h3 className="room-card__name">{room.name}</h3>
      </div>
      <div className="room-card__meta">
        <div>
          <div style={{ marginTop: 4 }}>
            by {room.createdBy} · created {relativeTime(room.createdAt)}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: "var(--mute-2)",
            alignSelf: "flex-end",
          }}
        >
          →
        </span>
      </div>
    </div>
  );
}

function RoomTrashModal({
  open,
  onClose,
  deletedRooms,
}: {
  open: boolean;
  onClose: () => void;
  deletedRooms: Room[];
}) {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Deleted rooms"
      >
        <h2 className="modal__title">Trash · rooms</h2>
        <p className="modal__sub">
          Restore brings the room back with all entries and columns intact.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: "16px 0 0",
            padding: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {deletedRooms.length === 0 ? (
            <li style={{ fontSize: 13, color: "var(--mute-2)" }}>
              No deleted rooms.
            </li>
          ) : (
            deletedRooms.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--paper)",
                  border: "1px solid var(--rule)",
                  borderRadius: 8,
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 18,
                      color: "var(--ink)",
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mute)" }}>
                    deleted{" "}
                    {r.deletedAt ? relativeTime(r.deletedAt) : ""}
                    {r.deletedBy ? ` by ${r.deletedBy}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--quiet btn--small"
                  onClick={() =>
                    restoreRoom({ roomId: r.id }).catch((err) =>
                      console.error("restoreRoom failed", err),
                    )
                  }
                >
                  Restore
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
