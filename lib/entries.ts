"use client";

// Entry creation, with client-side Gemini extraction.
//
// Strategy: write the entry doc with extracted = { <key>: { status:
// "extracting" } } so the table immediately shows a row with spinner
// cells. Then call Gemini in the browser to fill the extracted map
// and updateDoc the result back to Firestore.
//
// (The server-side version of this used /api/extract + firebase-admin
// to bypass rules. For static GH-Pages hosting we do the writes from
// the browser directly — see firestore.rules for the relaxed rule that
// allows entry updates.)

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDbOrNull } from "./firebase";
import { extractFieldsClient } from "./gemini-client";
import type { Category, CategorySpec, ExtractedMap } from "./types";
import { METADATA_KEYS } from "./types";

// Manually override a single cell's value (the user correcting the LLM).
// Writes to entry.extracted[key] with status "ok" + editedAt/editedBy.
// Does NOT clobber other cells; uses dot-path syntax so concurrent
// re-extractions on different keys are safe.
export async function updateExtractedValue(args: {
  roomId: string;
  entryId: string;
  categoryKey: string;
  value: string | string[] | null;
  editedBy: string;
}): Promise<void> {
  const db = getDbOrNull();
  if (!db) throw new Error("Firebase isn't configured.");
  await updateDoc(doc(db, "rooms", args.roomId, "entries", args.entryId), {
    [`extracted.${args.categoryKey}`]: {
      value: args.value,
      status: "ok",
      editedAt: Date.now(),
      editedBy: args.editedBy,
    },
  });
}

// Edit the raw drivel text on an existing entry — the user fixing a
// typo or rewording their original note. Existing extracted cells are
// untouched (they don't re-run automatically), but a future re-extraction
// over a newly-added column will use the corrected drivel. Empty input
// is rejected so the source of truth never goes blank.
export async function updateEntryDrivel(args: {
  roomId: string;
  entryId: string;
  drivel: string;
}): Promise<void> {
  const db = getDbOrNull();
  if (!db) throw new Error("Firebase isn't configured.");
  const trimmed = args.drivel.trim();
  if (trimmed.length === 0) {
    throw new Error("Drivel can't be empty.");
  }
  await updateDoc(doc(db, "rooms", args.roomId, "entries", args.entryId), {
    drivel: trimmed,
  });
}

// Soft-delete an entry (sets deletedAt timestamp). The entry is hidden
// from the table by default but its drivel + extracted map are kept
// untouched so restoring brings it back exactly as it was.
export async function deleteEntry(args: {
  roomId: string;
  entryId: string;
  deletedBy: string;
}): Promise<void> {
  const db = getDbOrNull();
  if (!db) throw new Error("Firebase isn't configured.");
  await updateDoc(doc(db, "rooms", args.roomId, "entries", args.entryId), {
    deletedAt: Date.now(),
    deletedBy: args.deletedBy,
  });
}

export async function restoreEntry(args: {
  roomId: string;
  entryId: string;
}): Promise<void> {
  const db = getDbOrNull();
  if (!db) throw new Error("Firebase isn't configured.");
  await updateDoc(doc(db, "rooms", args.roomId, "entries", args.entryId), {
    deletedAt: null,
    deletedBy: null,
  });
}

export class EntrySubmitError extends Error {
  code: "no-firestore" | "blank-drivel" | "blank-identity";
  constructor(code: EntrySubmitError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// Returns the new entry id. Resolves once the row is written; the
// extraction job runs separately (`runExtraction`) and updates cells
// asynchronously.
export async function submitEntry(args: {
  roomId: string;
  drivel: string;
  submittedBy: string;
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
    _serverWrittenAt: serverTimestamp(),
  });

  return docRef.id;
}

// Run Gemini against a freshly-submitted entry's drivel and write the
// extracted values back per cell. Errors are stamped as status: "error"
// at the cell level; one bad cell shouldn't kill the others.
export async function runExtraction(args: {
  roomId: string;
  entryId: string;
  drivel: string;
  categories: Category[];
}): Promise<void> {
  const db = getDbOrNull();
  if (!db) return;

  const extractable = args.categories.filter(
    (c) => !METADATA_KEYS.has(c.key),
  );
  if (extractable.length === 0) return;

  const specs: CategorySpec[] = extractable.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
    type: c.type,
  }));

  const ref = doc(db, "rooms", args.roomId, "entries", args.entryId);

  let extractedMap: Record<string, string | string[] | null>;
  try {
    extractedMap = await extractFieldsClient(args.drivel, specs);
  } catch (err) {
    // Mark every cell as errored so the row stays visible.
    const writes: Record<string, unknown> = {};
    for (const c of extractable) {
      writes[`extracted.${c.key}`] = {
        value: null,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
    await updateDoc(ref, writes);
    return;
  }

  const writes: Record<string, unknown> = {};
  const now = Date.now();
  for (const c of extractable) {
    const value = extractedMap[c.key] ?? null;
    writes[`extracted.${c.key}`] = {
      value,
      status: "ok",
      extractedAt: now,
    };
  }
  await updateDoc(ref, writes);
}
