"use client";

// "Your rooms." screen — editorial display heading + dashed new-room
// composer + 2-col grid of room cards with column pills + entry count
// in italic serif. From the Lightbook Lite design.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRooms } from "@/lib/hooks/useRooms";
import { createRoom, RoomCreateError } from "@/lib/rooms";

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

export default function RoomSwitcher({ identity }: Props) {
  const router = useRouter();
  const { rooms, ready, configured } = useRooms();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitting) return;
    setSubmitting(true);
    try {
      const slug = await createRoom(draft, identity);
      setDraft("");
      router.push(`/rooms/${slug}`);
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
            Copy <code>.env.local.example</code> to{" "}
            <code>.env.local</code> and paste your Firebase web SDK config.
            The dev server will hot-reload once you save.
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
          Each room is its own table — different people, different columns.
          Share the link and anyone with it can add drivel.
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
        </div>

        {!ready ? (
          <p
            style={{ fontSize: 14, color: "var(--mute)", marginTop: 8 }}
          >
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
              <RoomCard key={r.id} room={r} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function RoomCard({
  room,
}: {
  room: {
    id: string;
    name: string;
    slug: string;
    createdBy: string;
    createdAt: number;
  };
}) {
  const router = useRouter();
  return (
    <button
      className="room-card"
      onClick={() => router.push(`/rooms/${room.slug}`)}
    >
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
    </button>
  );
}
