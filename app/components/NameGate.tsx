"use client";

// Two-column "Dump drivel. Get a tidy table." gate, exactly per the
// Lightbook Lite design. Editorial display heading on the left, sample
// drivel→table card on the right rotated -1.4deg for the hand-cut feel.

import { useEffect, useRef, useState, type FormEvent } from "react";

type Props = {
  initialValue?: string | null;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
};

export default function NameGate({ initialValue, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (!t) {
      setError("Type at least one character.");
      return;
    }
    onSubmit(t);
  }

  return (
    <div className="gate">
      <div className="gate__left">
        <div>
          <p className="eyebrow">Drivel · 01</p>
          <h1 className="h-display" style={{ marginTop: 18 }}>
            Dump <em>drivel</em>.<br />
            Get a tidy <em>table</em>.
          </h1>
          <p className="lede" style={{ marginTop: 22 }}>
            Type whatever you remember about someone you met — full
            sentences, half-thoughts, weird tangents. An LLM sorts it into
            columns. Add a column whenever you want; old rows fill in
            automatically.
          </p>
        </div>

        <form className="gate__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Your first name</span>
            <input
              ref={inputRef}
              className="input"
              placeholder="Mira"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <p className="gate__hint">
            Shown in the{" "}
            <span style={{ color: "var(--ink)" }}>by</span> column on every
            entry you write. No password, no email.
          </p>
          <div className="gate__cta">
            {onCancel && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn--primary">
              Continue →
            </button>
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

        <div className="gate__steps">
          <span>1 · Pick a name</span>
          <span className="dim">2 · Open or make a room</span>
          <span className="dim">3 · Paste drivel</span>
        </div>
      </div>

      <aside className="gate__right">
        <SampleTransform />
      </aside>
    </div>
  );
}

function SampleTransform() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div className="sample-card">
        <span className="sample-card__tag">Drivel in</span>
        <p className="sample-card__drivel">
          &ldquo;Met Priya at the Figma config afterparty — staff PM at
          Linear, into bouldering and pottery. Wants to swap notes
          Friday.&rdquo;
        </p>
        <span
          className="sample-card__tag"
          style={{ background: "var(--paper-2)", color: "var(--mute)" }}
        >
          Table out
        </span>
        <dl style={{ margin: 0 }}>
          <div className="sample-card__row">
            <dt>Name</dt>
            <dd>Priya Shah</dd>
          </div>
          <div className="sample-card__row">
            <dt>Company</dt>
            <dd>Linear</dd>
          </div>
          <div className="sample-card__row">
            <dt>Role</dt>
            <dd>Staff PM</dd>
          </div>
          <div className="sample-card__row">
            <dt>Where met</dt>
            <dd>Figma Config afterparty</dd>
          </div>
          <div className="sample-card__row">
            <dt>Hobbies</dt>
            <dd>bouldering, pottery</dd>
          </div>
          <div className="sample-card__row">
            <dt>Follow-up</dt>
            <dd>Ping Friday re: roadmap</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
