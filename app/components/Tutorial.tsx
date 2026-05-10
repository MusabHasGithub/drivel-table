"use client";

// Unskippable first-run tutorial. A slide-deck modal that:
//   - Has no close button. No "X". No "skip".
//   - Clicking the scrim does NOT dismiss.
//   - Pressing Escape does NOT dismiss.
//   - Only path out is the final-slide CTA, which marks the tutorial
//     done in localStorage.
//
// The slides reuse the design vocabulary from the Lightbook Lite system
// (italic serif display, eyebrow numerals, sample cards, identity chip,
// tag pills, status pills) so the user is implicitly learning to read
// the UI as they read the tutorial.

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  identity: string;
  onComplete: () => void;
};

export default function Tutorial({ identity, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const slides = buildSlides(identity);
  const total = slides.length;
  const isLast = step === total - 1;

  // Block Escape so the user can't escape-out of the modal.
  // The scrim's onClick does nothing for the same reason.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  // Lock body scroll while the tutorial is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function next() {
    if (isLast) {
      onComplete();
      return;
    }
    setStep(step + 1);
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }

  const slide = slides[step];

  return (
    <div
      className="scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Drivel tutorial"
      // Intentionally no onClick → clicking outside the modal does nothing.
    >
      <div className="modal tutorial">
        <div className="tutorial__head">
          <span className="eyebrow">
            {String(step + 1).padStart(2, "0")} · of {String(total).padStart(2, "0")}
          </span>
          <div className="tutorial__dots" aria-hidden="true">
            {slides.map((_, i) => (
              <span
                key={i}
                className={
                  "tutorial__dot " + (i === step ? "tutorial__dot--on" : "")
                }
              />
            ))}
          </div>
        </div>

        <h2 className="modal__title tutorial__title">{slide.title}</h2>
        {slide.lede && (
          <p className="lede tutorial__lede">{slide.lede}</p>
        )}

        {slide.body && <div className="tutorial__body">{slide.body}</div>}

        <div className="tutorial__foot">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={prev}
            disabled={step === 0}
          >
            ← Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={next}
            autoFocus
          >
            {isLast ? slide.ctaFinal ?? "Let’s go →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Slide = {
  title: string;
  lede?: string;
  body?: ReactNode;
  ctaFinal?: string;
};

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

function buildSlides(identity: string): Slide[] {
  return [
    {
      title: "Welcome to drivel.",
      lede:
        "Two minutes. Then you’ll know how the whole thing works. We won’t make you do this again.",
      body: (
        <div className="tutorial__hero">
          <span className="brand__mark" style={{ fontSize: 32, width: 56, height: 56, borderRadius: 14 }}>d</span>
          <p style={{ marginTop: 12, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1.2, color: "var(--mute)", letterSpacing: "-0.005em" }}>
            Dump drivel. Get a tidy table.
          </p>
        </div>
      ),
    },
    {
      title: "You are your name.",
      lede:
        "There’s no password and no email. Whatever you typed is your byline — it shows up next to every entry you write so other people can tell who said what.",
      body: (
        <div className="tutorial__demo">
          <span className="identity-chip">
            <span className="identity-chip__dot">{initials(identity)}</span>
            <span>{identity}</span>
          </span>
          <p className="tutorial__demo-caption">
            That’s you. You can change it any time from the top bar.
          </p>
        </div>
      ),
    },
    {
      title: "Rooms are tables.",
      lede:
        "Each room is its own shared table — different people, different columns. Make a room for work folks, another for wedding guests, another for the people you met in Lisbon. Anyone with the link can add drivel to a room.",
      body: (
        <div className="tutorial__rooms">
          <MiniRoomCard name="Work people" by="Mira" entries={41} />
          <MiniRoomCard name="Wedding guests" by="You" entries={0} />
        </div>
      ),
    },
    {
      title: "Paste drivel, get a row.",
      lede:
        "Type whatever you remember — sentences, fragments, half-spelled names, the whole tangent. The LLM pulls a row out of it. The cells you haven’t added yet just sit there waiting; the ones you have fill in within a couple seconds.",
      body: (
        <div className="tutorial__transform">
          <div className="tutorial__t-side">
            <span className="sample-card__tag">Drivel in</span>
            <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 18, lineHeight: 1.4, margin: "8px 0 0", color: "var(--ink)" }}>
              “Met Priya at the Figma config afterparty — staff PM at Linear, into bouldering and pottery.”
            </p>
          </div>
          <div style={{ alignSelf: "center", color: "var(--mute-2)", fontSize: 22, padding: "0 12px" }}>→</div>
          <div className="tutorial__t-side">
            <span
              className="sample-card__tag"
              style={{ background: "var(--paper-2)", color: "var(--mute)" }}
            >
              Row out
            </span>
            <dl style={{ margin: "8px 0 0" }}>
              <MiniRow k="Name" v="Priya Shah" />
              <MiniRow k="Company" v="Linear" />
              <MiniRow k="Role" v="Staff PM" />
            </dl>
          </div>
        </div>
      ),
    },
    {
      title: "Add a column anytime. Old rows fill in.",
      lede:
        "This is the trick. Hit + Column on any room and the LLM goes back over every entry’s original drivel to fill that new cell. Nothing is lost — your raw notes are kept forever and re-asked whenever you decide a new column matters.",
      body: (
        <div className="tutorial__addcol">
          <div className="tutorial__row-mini">
            <span className="cell-name">Priya Shah</span>
            <span className="status status--extracting">
              <span className="dot" />
              extracting…
            </span>
          </div>
          <p className="tutorial__demo-caption">
            New column appears with “extracting…” spinners → cells flip to values per row.
          </p>
        </div>
      ),
    },
    {
      title: "You’re ready.",
      lede:
        "Make a room, paste your first drivel, and watch a row appear. A few moves you’ll discover: click any column header to sort, drag a header sideways to reorder, click a person’s name in the table to see their full original note.",
      ctaFinal: "Start dumping drivel →",
    },
  ];
}

function MiniRoomCard({
  name,
  by,
  entries,
}: {
  name: string;
  by: string;
  entries: number;
}) {
  return (
    <div className="tutorial__room-card">
      <h4 className="room-card__name" style={{ fontSize: 18 }}>
        {name}
      </h4>
      <div className="room-card__meta" style={{ marginTop: 8, fontSize: 11 }}>
        <span>by {by}</span>
        <span>
          {entries} {entries === 1 ? "entry" : "entries"}
        </span>
      </div>
    </div>
  );
}

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 1fr",
        gap: 6,
        padding: "4px 0",
        borderTop: "1px dashed var(--rule)",
        fontSize: 12,
      }}
    >
      <dt
        style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--mute)",
          alignSelf: "center",
        }}
      >
        {k}
      </dt>
      <dd style={{ margin: 0, color: "var(--ink)" }}>{v}</dd>
    </div>
  );
}
