"use client";

// Interactive first-run tutorial. NOT a slide deck — it's a small fixed
// panel at the bottom-right that walks the user through every feature
// by detecting them DOING each thing (paste drivel → row appears →
// add column → delete entry → restore from trash → toggle theme).
//
// Auto-creates and auto-routes the user to a shared "tutorial" room
// (slug `tutorial`) so they don't have to make their own room first.
// The tutorial room is shared across all users — by design. Mess in it
// is fine; the tutorial step "delete + restore" naturally cleans up.
//
// The user can't skip the tutorial: there's no close button, the panel
// follows them across page navigations, and steps that require an action
// auto-advance only when they complete the action.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCategories } from "@/lib/hooks/useCategories";
import { useEntries } from "@/lib/hooks/useEntries";
import { useIdentity } from "@/lib/hooks/useIdentity";
import { useTheme } from "@/lib/hooks/useTheme";
import { useTutorial } from "@/lib/hooks/useTutorial";
import { ensureTutorialRoom, TUTORIAL_ROOM_ID } from "@/lib/rooms";
import { METADATA_KEYS } from "@/lib/types";

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
  const { theme } = useTheme();

  // Subscribe to the tutorial room's data regardless of where the user
  // is. Detection works even if they navigate away mid-step.
  const { entries: allEntries } = useEntries(TUTORIAL_ROOM_ID, {
    includeDeleted: true,
  });
  const { categories: allCategories } = useCategories(TUTORIAL_ROOM_ID, {
    includeDeleted: true,
  });

  // Capture baseline counts at the moment we entered the current step,
  // so detection is "did N+ rows / N+ columns appear since entering this
  // step?" rather than "are there any at all?".
  const [baseline, setBaseline] = useState(() => snapshot(allEntries, allCategories, theme));
  const lastStepRef = useRef(step);

  useEffect(() => {
    if (lastStepRef.current !== step) {
      setBaseline(snapshot(allEntries, allCategories, theme));
      lastStepRef.current = step;
    }
    // Also reset baseline when subscriptions hydrate (initial counts != 0
    // for an existing room — without this the "Add an entry" step would
    // auto-advance immediately just because there were already entries).
    if (allEntries.length > 0 && baseline.entryCount === 0 && step === 1) {
      setBaseline(snapshot(allEntries, allCategories, theme));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allEntries.length, allCategories.length]);

  const inTutorialRoom =
    pathname === "/rooms" && searchParams.get("id") === TUTORIAL_ROOM_ID;

  // ====== Step machine ======
  // Each step has: kind (auto vs manual), title, body, ctaLabel?,
  // and a detector function for auto steps that returns true when the
  // user has completed it.

  const STEPS = makeSteps({
    identity: identity ?? "",
    inTutorialRoom,
    baseline,
    entries: allEntries,
    categories: allCategories,
    theme,
  });

  // On mount + whenever identity is set: ensure the tutorial room
  // exists in Firestore.
  useEffect(() => {
    if (!identityHydrated || !identity || done) return;
    ensureTutorialRoom(identity).catch((err) => {
      console.error("[Tutorial] ensureTutorialRoom failed", err);
    });
  }, [identity, identityHydrated, done]);

  // Auto-route the user into the tutorial room when they're on the
  // home page and tutorial isn't done yet. Without this they'd see the
  // tutorial panel pointing at a room they aren't on.
  useEffect(() => {
    if (!identityHydrated || !tutorialHydrated || !identity || done) return;
    // Welcome step (0): keep them on home until they click Next.
    // Step 1 onwards: must be in the tutorial room.
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

  // Auto-advance for steps with a detector that's now satisfied.
  useEffect(() => {
    if (done || !identityHydrated || !tutorialHydrated || !identity) return;
    const current = STEPS[step];
    if (!current) return;
    if (current.kind === "auto" && current.detect()) {
      const nextStep = step + 1;
      if (nextStep >= STEPS.length) {
        complete();
      } else {
        setStep(nextStep);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allEntries, allCategories, theme, inTutorialRoom]);

  if (!identityHydrated || !tutorialHydrated || !identity || done) return null;

  const current = STEPS[step];
  if (!current) return null;

  const total = STEPS.length;

  return (
    <aside
      className="tut"
      role="dialog"
      aria-label={`Tutorial step ${step + 1} of ${total}`}
    >
      <div className="tut__head">
        <span className="eyebrow">
          Tutorial · step {String(step + 1).padStart(2, "0")} of{" "}
          {String(total).padStart(2, "0")}
        </span>
        <div className="tut__dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={"tut__dot " + (i === step ? "tut__dot--on" : i < step ? "tut__dot--past" : "")}
            />
          ))}
        </div>
      </div>
      <h3 className="tut__title">{current.title}</h3>
      {current.body && <div className="tut__body">{current.body}</div>}

      <div className="tut__foot">
        {current.kind === "auto" ? (
          <span className="tut__waiting">
            <span className="tut__pulse" /> waiting for you to do it…
          </span>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            if (step > 0) setStep(step - 1);
          }}
          disabled={step === 0}
        >
          ← Back
        </button>
        {current.kind === "manual" && (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              const next = step + 1;
              if (next >= STEPS.length) complete();
              else setStep(next);
            }}
          >
            {current.ctaLabel ?? "Next →"}
          </button>
        )}
      </div>
    </aside>
  );
}

type Snapshot = {
  entryCount: number; // not-deleted
  totalEntryCount: number; // including deleted
  categoryCount: number; // not-deleted
  totalCategoryCount: number;
  deletedEntryCount: number;
  theme: string;
};

function snapshot(
  entries: { deletedAt?: number | null }[],
  categories: { deletedAt?: number | null }[],
  theme: string,
): Snapshot {
  return {
    entryCount: entries.filter((e) => !e.deletedAt).length,
    totalEntryCount: entries.length,
    categoryCount: categories.filter((c) => !c.deletedAt).length,
    totalCategoryCount: categories.length,
    deletedEntryCount: entries.filter((e) => !!e.deletedAt).length,
    theme,
  };
}

type Step =
  | { kind: "manual"; title: string; body: ReactNode; ctaLabel?: string }
  | { kind: "auto"; title: string; body: ReactNode; detect: () => boolean };

function makeSteps(args: {
  identity: string;
  inTutorialRoom: boolean;
  baseline: Snapshot;
  entries: {
    submittedAt: number;
    deletedAt?: number | null;
    extracted?: Record<string, { status: string }>;
  }[];
  categories: { key: string; deletedAt?: number | null }[];
  theme: string;
}): Step[] {
  const { baseline, entries, categories, theme } = args;
  const activeEntries = entries.filter((e) => !e.deletedAt);
  const activeCategories = categories.filter((c) => !c.deletedAt);
  const newestEntry = [...activeEntries].sort(
    (a, b) => b.submittedAt - a.submittedAt,
  )[0];

  return [
    // Step 0 — welcome / context. Manual.
    {
      kind: "manual",
      title: "Hi. Quick walkthrough.",
      body: (
        <p style={{ margin: 0 }}>
          I&apos;ll walk you through every feature in about two minutes.
          You&apos;ll be doing the actions yourself — just follow the steps.
          When you click Next I&apos;ll drop you in a shared{" "}
          <em style={{ fontStyle: "italic" }}>tutorial</em> room you can
          mess around in.
        </p>
      ),
      ctaLabel: "Take me there →",
    },
    // Step 1 — paste drivel.
    {
      kind: "auto",
      title: "Paste some drivel and click Add.",
      body: (
        <p style={{ margin: 0 }}>
          Type a sentence or two about a person — a real one or made up.
          Click <b>Add entry</b>. A row will appear with the cells
          showing &ldquo;extracting…&rdquo;.
        </p>
      ),
      detect: () => baseline.entryCount + 1 <= activeEntries.length,
    },
    // Step 2 — wait for extraction.
    {
      kind: "auto",
      title: "Watch the cells fill in.",
      body: (
        <p style={{ margin: 0 }}>
          That&apos;s Gemini reading your text. The Person Name should
          land in a couple of seconds. Wait for it.
        </p>
      ),
      detect: () => {
        if (!newestEntry) return false;
        const c = newestEntry.extracted?.["person_name"];
        return c?.status === "ok";
      },
    },
    // Step 3 — add a column.
    {
      kind: "auto",
      title: "Add a new column.",
      body: (
        <p style={{ margin: 0 }}>
          Click <b>+ Column</b> in the section bar. Try{" "}
          <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Hobby</code>{" "}
          or{" "}
          <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Job</code>.
          Submit. The column will appear and back-fill all existing rows.
        </p>
      ),
      detect: () => baseline.categoryCount < activeCategories.length,
    },
    // Step 4 — try sort + drag.
    {
      kind: "manual",
      title: "Sort and reorder columns.",
      body: (
        <p style={{ margin: 0 }}>
          Click any column header to cycle through sort. Drag a header
          sideways to reorder it (each person&apos;s order is local — it
          doesn&apos;t change anyone else&apos;s view). Click Next when
          you&apos;ve tried both.
        </p>
      ),
      ctaLabel: "Tried it →",
    },
    // Step 5 — delete an entry. Detected when the deleted-count goes up.
    {
      kind: "auto",
      title: "Delete an entry.",
      body: (
        <p style={{ margin: 0 }}>
          Hover any row — a small trash icon appears at the right end.
          Click it. A confirm dialog asks if you&apos;re sure. Click{" "}
          <b>Delete entry</b>. Nothing is wiped — it just hides.
        </p>
      ),
      detect: () =>
        entries.filter((e) => !!e.deletedAt).length >
        baseline.deletedEntryCount,
    },
    // Step 6 — restore from trash.
    {
      kind: "auto",
      title: "Restore it from Trash.",
      body: (
        <p style={{ margin: 0 }}>
          Click <b>Trash</b> in the section bar. Find the entry you just
          deleted and click <b>Restore</b>. It pops back into the table
          exactly as it was.
        </p>
      ),
      detect: () => {
        // Detected when the deleted-count drops below the baseline
        // captured at the start of this step (which itself jumped one
        // up after the user deleted in step 5).
        return entries.filter((e) => !!e.deletedAt).length < baseline.deletedEntryCount + 1;
      },
    },
    // Step 7 — toggle theme.
    {
      kind: "auto",
      title: "Toggle dark mode.",
      body: (
        <p style={{ margin: 0 }}>
          Click the sun/moon icon in the top bar. Both modes look great
          (we may be biased). It&apos;ll remember your pick.
        </p>
      ),
      detect: () => theme !== baseline.theme,
    },
    // Step 8 — done.
    {
      kind: "manual",
      title: "You’re set.",
      body: (
        <p style={{ margin: 0 }}>
          That&apos;s every feature. Head back to <b>All rooms</b> to
          create your own — or stay here and add more drivel; the
          tutorial room is shared with everyone, so others may pop in.
        </p>
      ),
      ctaLabel: "Done — let me out →",
    },
  ];
}
