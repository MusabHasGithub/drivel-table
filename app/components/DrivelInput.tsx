"use client";

// "Composer" — the drivel textarea with lined-paper background, "Will fill"
// column-pill hint, word counter, and primary submit button. Visual: per
// the Lightbook Lite design.
//
// Behavior unchanged from the prior version: writes a new entry via
// lib/entries.ts, then the parent kicks off /api/extract.

import { useRef, useState, type FormEvent } from "react";
import { EntrySubmitError, submitEntry } from "@/lib/entries";
import type { Category } from "@/lib/types";
import { METADATA_KEYS } from "@/lib/types";

type Props = {
  roomId: string;
  identity: string;
  categories: Category[];
  onSubmitted?: (entryId: string, drivel: string) => void;
};

export default function DrivelInput({
  roomId,
  identity,
  categories,
  onSubmitted,
}: Props) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fillableCols = categories.filter((c) => !METADATA_KEYS.has(c.key));
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitting) return;
    setSubmitting(true);
    try {
      const entryId = await submitEntry({
        roomId,
        drivel: draft,
        submittedBy: identity,
        categories,
      });
      const drivel = draft.trim();
      setDraft("");
      onSubmitted?.(entryId, drivel);
      textareaRef.current?.focus();
    } catch (err) {
      if (err instanceof EntrySubmitError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Couldn't save — check the console for details.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer__head">
        <span className="composer__title">Add an entry</span>
        <span className="composer__hint">
          One person per entry — split paragraphs if you met multiple.
        </span>
      </div>

      <textarea
        ref={textareaRef}
        className="textarea drivel"
        placeholder="Met someone new? Just dump everything you remember — names, hobbies, where you met, what you said you'd follow up on. The LLM will sort it into columns."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={submitting}
      />

      <div className="composer__foot">
        <div className="composer__cols">
          {fillableCols.length > 0 && (
            <>
              <span>Will fill:</span>
              {fillableCols.map((c) => (
                <span key={c.key} className="col-pill">
                  {c.label}
                </span>
              ))}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--mute)" }}>
            {wordCount} word{wordCount === 1 ? "" : "s"}
          </span>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || draft.trim().length === 0}
          >
            {submitting ? "Saving…" : "Add entry"}
          </button>
        </div>
      </div>

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
    </form>
  );
}
