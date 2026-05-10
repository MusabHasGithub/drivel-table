"use client";

// Interactive first-run tutorial — sv-nodes-style callout popups.
//
// Each step optionally targets a `[data-tut="<id>"]` element somewhere
// in the page; the callout positions itself next to that element with
// a CSS-triangle arrow pointing back at it. Steps without a target
// render centered.
//
// Crucially the overlay uses `pointer-events: none` so clicks pass
// through to the page underneath — only the callout card captures
// pointer events. That's how the user can still hit "Delete entry"
// in the confirm modal (which is layered above with its own scrim)
// without the tutorial getting in the way.
//
// Auto-advance is unchanged — Firestore subscriptions on the shared
// "tutorial" room detect each action (add entry, add column, edit
// cell, delete, restore) and advance the step machine automatically.
// Steps that can't be auto-detected cleanly (sort + drag) use a
// manual Next button.
//
// Zero dim-layer, zero blocking. The popup just floats above the page,
// pointed at whatever's relevant.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCategories } from "@/lib/hooks/useCategories";
import { useEntries } from "@/lib/hooks/useEntries";
import { useIdentity } from "@/lib/hooks/useIdentity";
import { useTutorial } from "@/lib/hooks/useTutorial";
import { ensureTutorialRoom, TUTORIAL_ROOM_ID } from "@/lib/rooms";

type Side = "top" | "bottom" | "left" | "right";

type Step =
  | {
      kind: "manual";
      title: string;
      body: ReactNode;
      ctaLabel?: string;
      target?: string;
      side?: Side | "auto";
    }
  | {
      kind: "auto";
      title: string;
      body: ReactNode;
      detect: () => boolean;
      target?: string;
      side?: Side | "auto";
    };

export default function Tutorial() {
  const { name: identity, hydrated: identityHydrated } = useIdentity();
  const {
    done,
    step,
    setStep,
    hydrated: tutorialHydrated,
    complete,
  } = useTutorial();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { entries: allEntries } = useEntries(TUTORIAL_ROOM_ID, {
    includeDeleted: true,
  });
  const { categories: allCategories } = useCategories(TUTORIAL_ROOM_ID, {
    includeDeleted: true,
  });

  const [baseline, setBaseline] = useState(() =>
    snapshot(allEntries, allCategories),
  );
  const lastStepRef = useRef(step);

  useEffect(() => {
    if (lastStepRef.current !== step) {
      setBaseline(snapshot(allEntries, allCategories));
      lastStepRef.current = step;
    }
    if (allEntries.length > 0 && baseline.entryCount === 0 && step === 1) {
      setBaseline(snapshot(allEntries, allCategories));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allEntries.length, allCategories.length]);

  const inTutorialRoom =
    pathname === "/rooms" && searchParams.get("id") === TUTORIAL_ROOM_ID;

  const STEPS = makeSteps({
    baseline,
    entries: allEntries,
    categories: allCategories,
  });

  // Ensure tutorial room exists.
  useEffect(() => {
    if (!identityHydrated || !identity || done) return;
    ensureTutorialRoom(identity).catch((err) => {
      console.error("[Tutorial] ensureTutorialRoom failed", err);
    });
  }, [identity, identityHydrated, done]);

  // Auto-route into the tutorial room from step 1 onward.
  useEffect(() => {
    if (!identityHydrated || !tutorialHydrated || !identity || done) return;
    if (step >= 1 && !inTutorialRoom) {
      router.push(`/rooms/?id=${TUTORIAL_ROOM_ID}`);
    }
  }, [
    step,
    inTutorialRoom,
    identity,
    identityHydrated,
    tutorialHydrated,
    done,
    router,
  ]);

  // Auto-advance for satisfied detectors.
  useEffect(() => {
    if (done || !identityHydrated || !tutorialHydrated || !identity) return;
    const current = STEPS[step];
    if (!current) return;
    if (current.kind === "auto" && current.detect()) {
      const nextStep = step + 1;
      if (nextStep >= STEPS.length) complete();
      else setStep(nextStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allEntries, allCategories, inTutorialRoom]);

  if (!identityHydrated || !tutorialHydrated || !identity || done) return null;

  const current = STEPS[step];
  if (!current) return null;

  return (
    <Callout
      key={step /* re-mount on step change to re-measure target */}
      step={step}
      total={STEPS.length}
      stepDef={current}
      onBack={() => {
        if (step > 0) setStep(step - 1);
      }}
      onNext={() => {
        const next = step + 1;
        if (next >= STEPS.length) complete();
        else setStep(next);
      }}
      onSkip={complete}
      canGoBack={step > 0}
    />
  );
}

function Callout({
  step,
  total,
  stepDef,
  onBack,
  onNext,
  onSkip,
  canGoBack,
}: {
  step: number;
  total: number;
  stepDef: Step;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  canGoBack: boolean;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({
    w: typeof window === "undefined" ? 1200 : window.innerWidth,
    h: typeof window === "undefined" ? 800 : window.innerHeight,
  });

  // Track viewport for clamping.
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Track target rect (re-measure on resize / scroll). Same defensive
  // pattern as sv-nodes — only setState when the rect meaningfully moves
  // so we don't thrash React.
  const target = stepDef.target;
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let lastRect: DOMRect | null = null;
    const update = () => {
      const el = document.querySelector(target);
      const next = el ? (el as HTMLElement).getBoundingClientRect() : null;
      if (
        next &&
        lastRect &&
        Math.abs(next.left - lastRect.left) < 1 &&
        Math.abs(next.top - lastRect.top) < 1 &&
        Math.abs(next.width - lastRect.width) < 1 &&
        Math.abs(next.height - lastRect.height) < 1
      ) {
        return;
      }
      lastRect = next;
      setRect(next);
    };
    update();
    // Retry a few times if the element wasn't found yet (it might be
    // mounted lazily on a route the user hasn't reached).
    const retryHandle = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(retryHandle);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  // Card position. Mirrors sv-nodes' geometry.
  const CARD_W = Math.min(360, viewport.w - 24);
  const CARD_H_EST = 200;
  const GAP = 14;
  let cardLeft = viewport.w / 2 - CARD_W / 2;
  let cardTop = viewport.h - CARD_H_EST - 24;
  let arrowSide: Side | null = null;

  if (rect) {
    const side =
      stepDef.side && stepDef.side !== "auto"
        ? (stepDef.side as Side)
        : pickSide(rect, CARD_W, CARD_H_EST, viewport);
    arrowSide = side;
    if (side === "bottom") {
      cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
      cardTop = rect.bottom + GAP;
    } else if (side === "top") {
      cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
      cardTop = rect.top - CARD_H_EST - GAP;
    } else if (side === "right") {
      cardLeft = rect.right + GAP;
      cardTop = rect.top + rect.height / 2 - CARD_H_EST / 2;
    } else {
      cardLeft = rect.left - CARD_W - GAP;
      cardTop = rect.top + rect.height / 2 - CARD_H_EST / 2;
    }
  }
  cardLeft = clamp(cardLeft, 8, viewport.w - CARD_W - 8);
  cardTop = clamp(cardTop, 8, viewport.h - CARD_H_EST - 8);

  // Recompute arrow offset to keep it pointing at the target's center
  // even after the card was clamped to the viewport edge.
  let arrowOffsetX: number | undefined;
  let arrowOffsetY: number | undefined;
  if (rect && arrowSide) {
    if (arrowSide === "top" || arrowSide === "bottom") {
      const targetCenter = rect.left + rect.width / 2;
      arrowOffsetX = clamp(targetCenter - cardLeft, 16, CARD_W - 16);
    } else {
      const targetCenter = rect.top + rect.height / 2;
      arrowOffsetY = clamp(targetCenter - cardTop, 16, CARD_H_EST - 16);
    }
  }

  return (
    <div className="tut-overlay">
      {/* Optional: subtle ring around the target so the user's eye lands
          there. NO dim layer, NO click blocking. */}
      {rect && (
        <div
          className="tut-ring"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div
        className="tut-card"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
        role="dialog"
        aria-label={`Tutorial step ${step + 1}`}
      >
        {/* Skip "X" — top-right of card. Mirrors the sv-nodes pattern.
            Always available; ends the tutorial and marks it done. */}
        <button
          type="button"
          className="tut-card__skip"
          onClick={onSkip}
          aria-label="Skip tutorial"
          title="Skip tutorial"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="tut-card__head">
          <span className="eyebrow">
            Step {String(step + 1).padStart(2, "0")} ·{" "}
            {String(total).padStart(2, "0")}
          </span>
          <div className="tut-card__dots" aria-hidden="true">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={
                  "tut-card__dot " +
                  (i === step
                    ? "tut-card__dot--on"
                    : i < step
                      ? "tut-card__dot--past"
                      : "")
                }
              />
            ))}
          </div>
        </div>
        <h3 className="tut-card__title">{stepDef.title}</h3>
        <div className="tut-card__body">{stepDef.body}</div>

        <div className="tut-card__foot">
          {stepDef.kind === "auto" ? (
            <span className="tut-card__waiting">
              <span className="tut-card__pulse" /> waiting for you to do it…
            </span>
          ) : (
            <span style={{ flex: 1 }} />
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={onBack}
            disabled={!canGoBack}
          >
            ← Back
          </button>
          {stepDef.kind === "manual" && (
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={onNext}
            >
              {stepDef.ctaLabel ?? "Next →"}
            </button>
          )}
        </div>

        {arrowSide && (
          <span
            className={`tut-card__arrow tut-card__arrow--${arrowSide}`}
            style={
              arrowSide === "top" || arrowSide === "bottom"
                ? { left: arrowOffsetX }
                : { top: arrowOffsetY }
            }
          />
        )}
      </div>
    </div>
  );
}

type Snapshot = {
  entryCount: number;
  totalEntryCount: number;
  categoryCount: number;
  totalCategoryCount: number;
  deletedEntryCount: number;
};

function snapshot(
  entries: { deletedAt?: number | null }[],
  categories: { deletedAt?: number | null }[],
): Snapshot {
  return {
    entryCount: entries.filter((e) => !e.deletedAt).length,
    totalEntryCount: entries.length,
    categoryCount: categories.filter((c) => !c.deletedAt).length,
    totalCategoryCount: categories.length,
    deletedEntryCount: entries.filter((e) => !!e.deletedAt).length,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickSide(
  rect: DOMRect,
  cardW: number,
  cardH: number,
  vp: { w: number; h: number },
): Side {
  const room = {
    top: rect.top,
    bottom: vp.h - rect.bottom,
    left: rect.left,
    right: vp.w - rect.right,
  };
  if (room.bottom >= cardH + 24) return "bottom";
  if (room.right >= cardW + 24) return "right";
  if (room.top >= cardH + 24) return "top";
  if (room.left >= cardW + 24) return "left";
  // Fallback: whichever side has the most room.
  return (Object.entries(room).sort((a, b) => b[1] - a[1])[0][0] as Side);
}

function makeSteps(args: {
  baseline: Snapshot;
  entries: {
    submittedAt: number;
    deletedAt?: number | null;
    extracted?: Record<string, { status: string; editedAt?: number }>;
  }[];
  categories: { key: string; deletedAt?: number | null }[];
}): Step[] {
  const { baseline, entries, categories } = args;
  const activeEntries = entries.filter((e) => !e.deletedAt);
  const activeCategories = categories.filter((c) => !c.deletedAt);
  const newestEntry = [...activeEntries].sort(
    (a, b) => b.submittedAt - a.submittedAt,
  )[0];

  return [
    {
      kind: "manual",
      title: "Hi. Quick walkthrough.",
      body: (
        <p style={{ margin: 0 }}>
          I&apos;ll walk you through every feature in about two minutes.
          You&apos;ll be doing the actions — just follow each callout.
          Click Next and I&apos;ll drop you in a shared{" "}
          <em style={{ fontStyle: "italic" }}>tutorial</em> room.
        </p>
      ),
      ctaLabel: "Take me there →",
    },
    {
      kind: "auto",
      title: "Paste drivel and click Add.",
      body: (
        <p style={{ margin: 0 }}>
          Type a sentence about a person — real or made up. Click{" "}
          <b>Add entry</b>. A row appears with cells in
          &ldquo;extracting…&rdquo;.
        </p>
      ),
      target: '[data-tut="drivel-input"]',
      detect: () => baseline.entryCount + 1 <= activeEntries.length,
    },
    {
      kind: "auto",
      title: "Watch the cells fill in.",
      body: (
        <p style={{ margin: 0 }}>
          That&apos;s Gemini reading your text. Person Name lands in a
          couple of seconds.
        </p>
      ),
      target: '[data-tut="entries-table"]',
      detect: () => {
        if (!newestEntry) return false;
        const c = newestEntry.extracted?.["person_name"];
        return c?.status === "ok";
      },
    },
    {
      kind: "auto",
      title: "Add a new column.",
      body: (
        <p style={{ margin: 0 }}>
          Click <b>+ Column</b>. Try{" "}
          <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Hobby</code>{" "}
          or{" "}
          <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Job</code>.
          Existing rows back-fill automatically.
        </p>
      ),
      target: '[data-tut="add-column"]',
      detect: () => baseline.categoryCount < activeCategories.length,
    },
    {
      kind: "auto",
      title: "Correct a cell.",
      body: (
        <p style={{ margin: 0 }}>
          Click any value in the table to override it. Enter saves,
          Escape cancels. The LLM gets things wrong sometimes — fix
          them.
        </p>
      ),
      target: '[data-tut="entries-table"]',
      detect: () =>
        entries.some((e) =>
          Object.values(e.extracted ?? {}).some(
            (c) => !!(c as { editedAt?: number }).editedAt,
          ),
        ),
    },
    {
      kind: "manual",
      title: "Sort and reorder columns.",
      body: (
        <p style={{ margin: 0 }}>
          Click any column header to sort. Drag a header sideways to
          reorder. Each person&apos;s order is local — it doesn&apos;t
          change anyone else&apos;s view. Click Next when you&apos;ve
          tried both.
        </p>
      ),
      target: '[data-tut="entries-table"]',
      ctaLabel: "Tried it →",
    },
    {
      kind: "auto",
      title: "Delete an entry.",
      body: (
        <p style={{ margin: 0 }}>
          Hover any row — a small trash icon appears at the right end.
          Click it, then confirm. Nothing is wiped; it just hides.
        </p>
      ),
      target: '[data-tut="entries-table"]',
      detect: () =>
        entries.filter((e) => !!e.deletedAt).length >
        baseline.deletedEntryCount,
    },
    {
      kind: "auto",
      title: "Restore from Trash.",
      body: (
        <p style={{ margin: 0 }}>
          Open Trash, find the deleted entry, click <b>Restore</b>.
        </p>
      ),
      target: '[data-tut="trash-button"]',
      detect: () =>
        entries.filter((e) => !!e.deletedAt).length <
        baseline.deletedEntryCount + 1,
    },
    {
      kind: "manual",
      title: "You’re set.",
      body: (
        <p style={{ margin: 0 }}>
          Every feature, covered. Head back to <b>All rooms</b> to
          create your own — or keep adding drivel here. The tutorial
          room is shared with everyone.
        </p>
      ),
      ctaLabel: "Done — let me out →",
    },
  ];
}
