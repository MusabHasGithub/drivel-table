"use client";

// Adds a new column to a room, then runs the per-cell re-extraction over
// every existing entry IN THE BROWSER (no admin SDK in static-export
// mode — Firestore rules allow entry updates from the client).
//
// Concurrency capped at 5 so we don't trip Gemini's 15-RPM free-tier cap.

import {
  collection,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { getDbOrNull } from "./firebase";
import { extractFieldsClient, runWithConcurrency } from "./gemini-client";
import { slugify } from "./slugify";
import { BUILTIN_KEYS } from "./types";
import type { CategorySpec, CategoryType } from "./types";

const RESERVED_KEYS = new Set<string>([
  BUILTIN_KEYS.PERSON_NAME,
  BUILTIN_KEYS.SUBMITTED_BY,
  BUILTIN_KEYS.SUBMITTED_AT,
  BUILTIN_KEYS.RAW_DRIVEL,
]);

const REEXTRACT_CONCURRENCY = 5;

export class CategoryAddError extends Error {
  code:
    | "no-firestore"
    | "blank-label"
    | "blank-identity"
    | "reserved-key"
    | "already-exists";
  constructor(code: CategoryAddError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// Race-prevention: doc id = slugify(label), enforced via a transaction
// that reads-then-writes. Two users adding "Hobby" at the same instant:
// the slow one's transaction retries against the new state and throws
// "already exists".
export async function addCategory(args: {
  roomId: string;
  label: string;
  description?: string;
  type: CategoryType;
  createdBy: string;
}): Promise<{ key: string }> {
  const db = getDbOrNull();
  if (!db) {
    throw new CategoryAddError(
      "no-firestore",
      "Firebase isn't configured yet.",
    );
  }

  const label = args.label.trim();
  if (label.length === 0) {
    throw new CategoryAddError("blank-label", "Column name can't be empty.");
  }

  const createdBy = args.createdBy.trim();
  if (createdBy.length === 0) {
    throw new CategoryAddError(
      "blank-identity",
      "Set your name first (top-right).",
    );
  }

  const key = slugify(label);
  if (key.length === 0) {
    throw new CategoryAddError(
      "blank-label",
      "Column name needs at least one letter or number.",
    );
  }
  if (RESERVED_KEYS.has(key)) {
    throw new CategoryAddError(
      "reserved-key",
      `"${label}" collides with a built-in column. Pick a different name.`,
    );
  }

  const description = args.description?.trim();
  const docBody: Record<string, unknown> = {
    key,
    label,
    type: args.type,
    builtin: false,
    order: Date.now(),
    createdBy,
    createdAt: Date.now(),
  };
  if (description) docBody.description = description;

  await runTransaction(db, async (tx) => {
    const ref = doc(db, "rooms", args.roomId, "categories", key);
    const existing = await tx.get(ref);
    if (existing.exists()) {
      throw new CategoryAddError(
        "already-exists",
        `A column called "${label}" already exists.`,
      );
    }
    tx.set(ref, docBody);
  });

  return { key };
}

// Re-extract one category over every existing entry in the room. Called
// after addCategory; runs in the browser. Cells are flipped to
// "extracting" first (so the UI shows spinners) then filled per-row.
export async function reextractRoomCategory(args: {
  roomId: string;
  category: CategorySpec;
}): Promise<{ processed: number; failed: number }> {
  const db = getDbOrNull();
  if (!db) return { processed: 0, failed: 0 };

  const snap = await getDocs(
    collection(db, "rooms", args.roomId, "entries"),
  );
  if (snap.empty) return { processed: 0, failed: 0 };

  // Mark every entry's new cell as "extracting" upfront so the UI shows
  // spinners across the whole column immediately.
  const initWrites = snap.docs.map((d) =>
    updateDoc(d.ref, {
      [`extracted.${args.category.key}`]: {
        value: null,
        status: "extracting",
      },
    }).catch((err) => {
      console.error(
        `[reextract] init failed for ${d.id}`,
        err,
      );
    }),
  );
  await Promise.all(initWrites);

  let processed = 0;
  let failed = 0;
  await runWithConcurrency(snap.docs, REEXTRACT_CONCURRENCY, async (d) => {
    const drivel = String(d.get("drivel") ?? "");
    if (!drivel) {
      await updateDoc(d.ref, {
        [`extracted.${args.category.key}`]: {
          value: null,
          status: "error",
          errorMessage: "Entry has no drivel text",
        },
      });
      failed++;
      return;
    }
    try {
      const result = await extractFieldsClient(drivel, [args.category]);
      await updateDoc(d.ref, {
        [`extracted.${args.category.key}`]: {
          value: result[args.category.key] ?? null,
          status: "ok",
          extractedAt: Date.now(),
        },
      });
      processed++;
    } catch (err) {
      await updateDoc(d.ref, {
        [`extracted.${args.category.key}`]: {
          value: null,
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      failed++;
    }
  });

  return { processed, failed };
}
