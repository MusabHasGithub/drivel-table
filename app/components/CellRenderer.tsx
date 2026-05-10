"use client";

// Cell rendering, per the Lightbook Lite design.
//
// Metadata cells (submitted_by / submitted_at / raw_drivel) read direct from
// the entry; extracted cells read from entry.extracted[key] with a per-cell
// status. The visual flavors:
//   - status "extracting" → pill with pulsing dot
//   - status "error"      → red pill, hover tooltip
//   - ok + null/[]        → "—" (Gemini was asked, drivel didn't say)
//   - ok + string array   → row of tag pills
//   - ok + person_name    → italic serif (the editorial accent)
//   - ok + other string   → plain text

import type { Entry, ExtractedCell } from "@/lib/types";
import { BUILTIN_KEYS, METADATA_KEYS } from "@/lib/types";

type Props = { entry: Entry; categoryKey: string };

export default function CellRenderer({ entry, categoryKey }: Props) {
  if (METADATA_KEYS.has(categoryKey)) {
    return <MetadataCell entry={entry} categoryKey={categoryKey} />;
  }
  return (
    <ExtractedCellView
      cell={entry.extracted?.[categoryKey]}
      categoryKey={categoryKey}
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

function ExtractedCellView({
  cell,
  categoryKey,
}: {
  cell: ExtractedCell | undefined;
  categoryKey: string;
}) {
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
