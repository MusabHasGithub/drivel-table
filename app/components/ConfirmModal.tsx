"use client";

// Reusable "Are you sure?" modal. Same scrim + popIn aesthetic as the
// other modals. The destructive variant tints the confirm button red and
// makes the icon a small bullet so it reads as a warning at a glance.
//
// Usage:
//   <ConfirmModal
//     open={confirmOpen}
//     title="Delete this entry?"
//     body="It moves to Trash. You can restore it from there."
//     confirmLabel="Delete"
//     destructive
//     onConfirm={async () => await deleteEntry(...)}
//     onClose={() => setConfirmOpen(false)}
//   />

import { useState } from "react";

type Props = {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onClose,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("[ConfirmModal] action failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="scrim"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="modal"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="modal__title" style={{ fontSize: 26 }}>
          {title}
        </h2>
        {body && (
          <div
            className="lede"
            style={{ marginTop: 4, marginBottom: 0, fontSize: 14 }}
          >
            {body}
          </div>
        )}
        <div className="modal__foot" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? "btn btn--danger" : "btn btn--primary"}
            onClick={handleConfirm}
            disabled={submitting}
            autoFocus
          >
            {submitting ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
