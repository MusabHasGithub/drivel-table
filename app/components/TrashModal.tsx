"use client";

// "Trash" view for one room — lists deleted entries + deleted categories
// with a Restore button next to each. Soft-deletes are reversible by
// design; the data was never wiped, just hidden.

import { useEntries } from "@/lib/hooks/useEntries";
import { useCategories } from "@/lib/hooks/useCategories";
import { restoreEntry } from "@/lib/entries";
import { restoreCategory } from "@/lib/categories";
import type { Category, Entry } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
};

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

export default function TrashModal({ open, onClose, roomId }: Props) {
  const { entries: allEntries } = useEntries(roomId, {
    includeDeleted: true,
  });
  const { categories: allCategories } = useCategories(roomId, {
    includeDeleted: true,
  });

  if (!open) return null;

  const deletedEntries = allEntries
    .filter((e) => !!e.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  const deletedCategories = allCategories
    .filter((c) => !!c.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 640, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Trash"
      >
        <h2 className="modal__title">Trash</h2>
        <p className="modal__sub">
          Nothing was actually deleted — just hidden. Restore brings it
          back exactly as it was.
        </p>

        <section style={{ marginTop: 18 }}>
          <h3
            style={{
              fontFamily: "var(--sans)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--mute)",
              margin: "0 0 10px",
            }}
          >
            Deleted columns
          </h3>
          {deletedCategories.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--mute-2)", margin: 0 }}>
              No deleted columns.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {deletedCategories.map((c) => (
                <DeletedCategoryRow
                  key={c.id}
                  category={c}
                  roomId={roomId}
                />
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h3
            style={{
              fontFamily: "var(--sans)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--mute)",
              margin: "0 0 10px",
            }}
          >
            Deleted entries
          </h3>
          {deletedEntries.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--mute-2)", margin: 0 }}>
              No deleted entries.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {deletedEntries.map((e) => (
                <DeletedEntryRow key={e.id} entry={e} roomId={roomId} />
              ))}
            </ul>
          )}
        </section>

        <div className="modal__foot" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeletedCategoryRow({
  category,
  roomId,
}: {
  category: Category;
  roomId: string;
}) {
  return (
    <li
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
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--ink)",
            fontWeight: 500,
          }}
        >
          {category.label}
        </div>
        <div style={{ fontSize: 12, color: "var(--mute)" }}>
          deleted{" "}
          {category.deletedAt ? relativeTime(category.deletedAt) : ""}
          {category.deletedBy ? ` by ${category.deletedBy}` : ""}
        </div>
      </div>
      <button
        type="button"
        className="btn btn--quiet btn--small"
        onClick={() =>
          restoreCategory({ roomId, categoryId: category.id }).catch((err) =>
            console.error("restoreCategory failed", err),
          )
        }
      >
        Restore
      </button>
    </li>
  );
}

function DeletedEntryRow({
  entry,
  roomId,
}: {
  entry: Entry;
  roomId: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
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
            fontSize: 13,
            color: "var(--ink)",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {entry.drivel}
        </div>
        <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
          deleted{" "}
          {entry.deletedAt ? relativeTime(entry.deletedAt) : ""}
          {entry.deletedBy ? ` by ${entry.deletedBy}` : ""}
        </div>
      </div>
      <button
        type="button"
        className="btn btn--quiet btn--small"
        onClick={() =>
          restoreEntry({ roomId, entryId: entry.id }).catch((err) =>
            console.error("restoreEntry failed", err),
          )
        }
      >
        Restore
      </button>
    </li>
  );
}
