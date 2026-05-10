"use client";

// Room creation. The interesting bit is `createRoom`: it atomically writes
// the room doc + four default category docs in a single transaction, so a
// half-created room can never exist (no doc with no categories, no
// orphan categories without a parent).
//
// Default categories seeded:
//   - person_name  (extracted by Gemini)
//   - submitted_by (metadata, rendered direct from entry.submittedBy)
//   - submitted_at (metadata, rendered direct from entry.submittedAt)
//   - raw_drivel   (metadata, rendered direct from entry.drivel)
//
// All four live in the categories subcollection so the table can iterate
// a single source of truth. The renderer branches on METADATA_KEYS (in
// lib/types.ts) to decide whether a column reads from entry.extracted
// or from the entry's top-level fields.

import { doc, runTransaction } from "firebase/firestore";
import { getDbOrNull } from "./firebase";
import { slugify } from "./slugify";
import { BUILTIN_KEYS } from "./types";

type DefaultCategory = {
  key: string;
  label: string;
  description?: string;
  type: "string" | "string_array";
  builtin: boolean;
  order: number;
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: BUILTIN_KEYS.PERSON_NAME,
    label: "Person Name",
    description:
      "The name of the person being described in this entry. If multiple names are mentioned, pick the one the entry is primarily about.",
    type: "string",
    builtin: true,
    order: 0,
  },
  {
    key: BUILTIN_KEYS.SUBMITTED_BY,
    label: "Submitted by",
    type: "string",
    builtin: true,
    order: 1,
  },
  {
    key: BUILTIN_KEYS.SUBMITTED_AT,
    label: "Submitted at",
    type: "string",
    builtin: true,
    order: 2,
  },
  {
    key: BUILTIN_KEYS.RAW_DRIVEL,
    label: "Drivel",
    type: "string",
    builtin: true,
    order: 3,
  },
];

export class RoomCreateError extends Error {
  code: "no-firestore" | "blank-name" | "already-exists";
  constructor(code: RoomCreateError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// Returns the slug of the newly created room. Throws RoomCreateError on
// the three handled failure modes; lets unexpected Firestore errors
// propagate as-is.
export async function createRoom(
  rawName: string,
  createdBy: string,
): Promise<string> {
  const db = getDbOrNull();
  if (!db) {
    throw new RoomCreateError(
      "no-firestore",
      "Firebase isn't configured yet. See .env.local.example.",
    );
  }

  const name = rawName.trim();
  if (name.length === 0) {
    throw new RoomCreateError("blank-name", "Room name can't be empty.");
  }

  const slug = slugify(name);
  if (slug.length === 0) {
    throw new RoomCreateError(
      "blank-name",
      "Room name needs at least one letter or number.",
    );
  }

  await runTransaction(db, async (tx) => {
    const roomRef = doc(db, "rooms", slug);
    const existing = await tx.get(roomRef);
    if (existing.exists()) {
      throw new RoomCreateError(
        "already-exists",
        `A room called "${name}" already exists.`,
      );
    }

    const now = Date.now();
    tx.set(roomRef, { name, slug, createdBy, createdAt: now });

    for (const cat of DEFAULT_CATEGORIES) {
      tx.set(doc(db, "rooms", slug, "categories", cat.key), {
        ...cat,
        createdBy,
        createdAt: now,
      });
    }
  });

  return slug;
}
