"use client";

// Add-column modal. Scrim with backdrop blur + popIn animation, type
// chosen via mock-radio "type cards" with mono examples. Per the Lightbook
// Lite design.
//
// Behavior: addCategory() writes the new category doc; the snapshot
// listener paints a new column with extracting cells; we POST
// /api/reextract-room to fill the cells over existing entries.

import { useEffect, useState, type FormEvent } from "react";
import {
  addCategory,
  CategoryAddError,
  reextractRoomCategory,
} from "@/lib/categories";
import type { CategoryType } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  identity: string;
};

export default function AddCategoryModal({
  open,
  onClose,
  roomId,
  identity,
}: Props) {
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [type, setType] = useState<CategoryType>("string");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel("");
      setHint("");
      setType("string");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitting) return;
    setSubmitting(true);
    try {
      const { key } = await addCategory({
        roomId,
        label,
        description: hint || undefined,
        type,
        createdBy: identity,
      });
      // Run the per-row re-extraction in the browser. Fire-and-forget;
      // the entries snapshot listener picks up each cell as it lands.
      void reextractRoomCategory({
        roomId,
        category: {
          key,
          label,
          description: hint || undefined,
          type,
        },
      }).catch((err) => {
        console.error("[AddCategoryModal] reextractRoomCategory failed", err);
      });
      onClose();
    } catch (err) {
      if (err instanceof CategoryAddError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Couldn't add column — check the console for details.");
      }
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
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="modal__title">Add a column</h2>
        <p className="modal__sub">
          Existing rows re-extract automatically — you&apos;ll see{" "}
          <span style={{ color: "var(--extract-fg)" }}>extracting…</span> in
          the new cells while it runs.
        </p>

        <div className="modal__body">
          <label className="field">
            <span className="field__label">Column name</span>
            <input
              autoFocus
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Hobby · Where met · Birthday"
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span className="field__label">
              Hint for the LLM{" "}
              <span
                style={{
                  textTransform: "none",
                  letterSpacing: 0,
                  color: "var(--mute-2)",
                  fontSize: 11,
                }}
              >
                (optional)
              </span>
            </span>
            <input
              className="input"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. their go-to coffee order"
              disabled={submitting}
            />
          </label>

          <div className="field">
            <span className="field__label">Type</span>
            <div className="type-grid">
              <button
                type="button"
                className="type-card"
                aria-pressed={type === "string"}
                onClick={() => setType("string")}
                disabled={submitting}
              >
                <div className="type-card__name">Single value</div>
                <div className="type-card__example">&ldquo;Linear&rdquo;</div>
              </button>
              <button
                type="button"
                className="type-card"
                aria-pressed={type === "string_array"}
                onClick={() => setType("string_array")}
                disabled={submitting}
              >
                <div className="type-card__name">List of values</div>
                <div className="type-card__example">
                  [&ldquo;bouldering&rdquo;, &ldquo;pottery&rdquo;]
                </div>
              </button>
            </div>
          </div>

          {error && (
            <p
              style={{
                color: "var(--error-fg)",
                fontSize: 13,
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div className="modal__foot">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || label.trim().length === 0}
          >
            {submitting ? "Adding…" : "Add column"}
          </button>
        </div>
      </form>
    </div>
  );
}
