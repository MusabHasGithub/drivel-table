"use client";

// Adds a new column to a room.
//
// Critical race-prevention: doc id = slugify(label), enforced via a
// transaction that reads-then-writes. Two users adding "Hobby" at the same
// instant: the slow one's transaction retries against the new state and
// throws "already exists" — neither user ends up with a duplicate column.
//
// Order: we use Date.now() as the `order` field, which makes new columns
// naturally append after older ones without needing an aggregate read.
// Per-user drag-reorder lives client-side in localStorage (see
// useColumnOrder.ts), so the server-side order is just the default.

import { doc, runTransaction } from "firebase/firestore";
import { getDbOrNull } from "./firebase";
import { slugify } from "./slugify";
import { BUILTIN_KEYS } from "./types";
import type { CategoryType } from "./types";

const RESERVED_KEYS = new Set<string>([
  BUILTIN_KEYS.PERSON_NAME,
  BUILTIN_KEYS.SUBMITTED_BY,
  BUILTIN_KEYS.SUBMITTED_AT,
  BUILTIN_KEYS.RAW_DRIVEL,
]);

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
    throw new CategoryAddError(
      "blank-label",
      "Column name can't be empty.",
    );
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

  // Build the doc body. Firestore doesn't accept `undefined` field values —
  // we omit `description` entirely when the user leaves it blank rather
  // than writing it as undefined.
  const description = args.description?.trim();
  const docBody: Record<string, unknown> = {
    key,
    label,
    type: args.type,
    builtin: false,
    // Date.now() guarantees monotonic-ish ordering without an aggregate
    // read. Concurrent adds resolve to distinct values 99.99% of the
    // time; ties are visually identical and user-resolvable via drag.
    order: Date.now(),
    createdBy,
    createdAt: Date.now(),
  };
  if (description) {
    docBody.description = description;
  }

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
