"use client";

// Cell rendering with click-to-edit overrides for AI-filled cells.
//
// Behavior:
//   - Metadata cells (submitted_by / submitted_at / raw_drivel) → read-only,
//     rendered direct from the entry. No edit affordance.
//   - Extracted cells (everything else) → click anywhere on the rendered
//     value to enter edit mode. Inline input. Enter or blur saves;
//     Escape cancels. For string_array columns the input takes
//     comma-separated values, parsed on save.
//   - "extracting…" cells → not editable (still in flight).
//
// Why click-to-edit (vs an explicit pencil icon): the design uses small
// pillar text already; an extra icon adds visual noise. The cursor:text
// hint on hover, plus the universally-known interaction pattern, makes
// it discoverable without UI clutter.

import { useEffect, useRef, useState } from "react";
import type { Category, Entry, ExtractedCell } from "@/lib/types";
import { BUILTIN_KEYS, METADATA_KEYS } from "@/lib/types";
import { updateExtractedValue } from "@/lib/entries";

type Props = {
  roomId: string;
  identity: string;
  entry: Entry;
  category: Category;
};

export default function CellRenderer({
  roomId,
  identity,
  entry,
  category,
}: Props) {
  if (METADATA_KEYS.has(category.key)) {
    return <MetadataCell entry={entry} categoryKey={category.key} />;
  }
  return (
    <ExtractedCellEditable
      roomId={roomId}
      identity={identity}
      entryId={entry.id}
      cell={entry.extracted?.[category.key]}
      category={category}
    />
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

function MetadataCell({
  entry,
  categoryKey,
}: {
  entry: Entry;
  categoryKey: string;
}) {
  if (categoryKey === BUILTIN_KEYS.SUBMITTED_BY) {
    return (
      <span className="cell-by">
        <span className="dot">{initials(entry.submittedBy)}</span>
        {entry.submittedBy}
      </span>
    );
  }
  if (categoryKey === BUILTIN_KEYS.SUBMITTED_AT) {
    return (
      <span
        className="cell-meta tip"
        data-tip={new Date(entry.submittedAt).toLocaleString()}
      >
        {relativeTime(entry.submittedAt)}
      </span>
    );
  }
  if (categoryKey === BUILTIN_KEYS.RAW_DRIVEL) {
    return (
      <span className="cell-drivel" title={entry.drivel}>
        {entry.drivel}
      </span>
    );
  }
  return null;
}

// Convert a cell value to the string the input should display when
// entering edit mode. Arrays become comma-separated; null becomes empty.
function valueToEditString(value: string | string[] | null | undefined): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

// Parse a user-typed string back into the right value shape for the
// category's type. Empty input → null (clears the cell to "—").
function parseEditString(
  raw: string,
  type: "string" | "string_array",
): string | string[] | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (type === "string_array") {
    const parts = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts : null;
  }
  return trimmed;
}

function ExtractedCellEditable({
  roomId,
  identity,
  entryId,
  cell,
  category,
}: {
  roomId: string;
  identity: string;
  entryId: string;
  cell: ExtractedCell | undefined;
  category: Category;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      // Defer to next frame so the input is mounted before focus.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  // Don't allow editing while a cell is mid-extraction — the value is
  // about to be overwritten by the LLM and editing now would race.
  const canEdit = !cell || cell.status !== "extracting";

  function startEdit() {
    if (!canEdit || saving) return;
    setDraft(valueToEditString(cell?.value));
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    const newValue = parseEditString(draft, category.type);
    const currentValue = cell?.value ?? null;
    // Skip the write if nothing changed (e.g. user clicked but typed
    // identical text).
    const sameAsBefore =
      JSON.stringify(newValue) === JSON.stringify(currentValue);
    if (sameAsBefore) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateExtractedValue({
        roomId,
        entryId,
        categoryKey: category.key,
        value: newValue,
        editedBy: identity,
      });
    } catch (err) {
      console.error("[CellRenderer] save failed", err);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft("");
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-edit"
        type="text"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={
          category.type === "string_array"
            ? "comma, separated, values"
            : "—"
        }
      />
    );
  }

  // Display mode. Wrap the rendered value in a span that handles click
  // and shows a subtle hover affordance.
  const display = renderDisplay(cell, category.key);
  return (
    <span
      className={canEdit ? "cell-editable" : ""}
      onClick={canEdit ? startEdit : undefined}
      title={canEdit ? "Click to edit" : undefined}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          startEdit();
        }
      }}
    >
      {display}
    </span>
  );
}

function renderDisplay(
  cell: ExtractedCell | undefined,
  categoryKey: string,
) {
  if (!cell || cell.status === "extracting") {
    return (
      <span className="status status--extracting">
        <span className="dot" />
        extracting…
      </span>
    );
  }

  if (cell.status === "error") {
    return (
      <span
        className="status status--error tip"
        data-tip={cell.errorMessage ?? "Extraction failed"}
      >
        <span className="dot" />
        error
      </span>
    );
  }

  // status === "ok"
  const v = cell.value;
  if (v == null || (Array.isArray(v) && v.length === 0)) {
    return <span className="cell-empty">—</span>;
  }
  if (Array.isArray(v)) {
    return (
      <span className="cell-list">
        {v.map((x) => (
          <span key={x} className="tag">
            {x}
          </span>
        ))}
      </span>
    );
  }
  if (categoryKey === BUILTIN_KEYS.PERSON_NAME) {
    return <span className="cell-name">{v}</span>;
  }
  return <span>{v}</span>;
}
