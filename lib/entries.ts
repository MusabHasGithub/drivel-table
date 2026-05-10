"use client";

// Entry creation (no Gemini yet — that wiring lands in the next step).
//
// Strategy: write the entry doc with extracted = { person_name: { status:
// "extracting" } } so the table can immediately render a row with a
// spinner in the Person Name cell. The /api/extract route then fills the
// extracted map via firebase-admin (bypassing rules) and the snapshot
// listener flips the cell from extracting → ok.

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDbOrNull } from "./firebase";
import type { Category, ExtractedMap } from "./types";
import { METADATA_KEYS } from "./types";

export class EntrySubmitError extends Error {
  code: "no-firestore" | "blank-drivel" | "blank-identity";
  constructor(code: EntrySubmitError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// Returns the new entry's id. Throws EntrySubmitError on the handled
// failure modes; lets unexpected Firestore errors bubble.
export async function submitEntry(args: {
  roomId: string;
  drivel: string;
  submittedBy: string;
  /** All categories currently on the room — used to seed `extracting` cells. */
  categories: Category[];
}): Promise<string> {
  const db = getDbOrNull();
  if (!db) {
    throw new EntrySubmitError(
      "no-firestore",
      "Firebase isn't configured yet.",
    );
  }

  const drivel = args.drivel.trim();
  if (drivel.length === 0) {
    throw new EntrySubmitError("blank-drivel", "Drivel can't be empty.");
  }

  const submittedBy = args.submittedBy.trim();
  if (submittedBy.length === 0) {
    throw new EntrySubmitError(
      "blank-identity",
      "Set your name first (top-right).",
    );
  }

  // Seed every non-metadata category as "extracting"; metadata columns
  // render directly from entry fields so they don't appear in this map.
  const extracted: ExtractedMap = {};
  for (const cat of args.categories) {
    if (METADATA_KEYS.has(cat.key)) continue;
    extracted[cat.key] = { value: null, status: "extracting" };
  }

  const docRef = await addDoc(collection(db, "rooms", args.roomId, "entries"), {
    drivel,
    submittedBy,
    submittedAt: Date.now(),
    extracted,
    // serverTimestamp is a nice-to-have audit field; ignore in app code.
    _serverWrittenAt: serverTimestamp(),
  });

  return docRef.id;
}
