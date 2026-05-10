// POST /api/extract
//
// Body: { roomId, entryId, drivel, categories: CategorySpec[] }
//
// Calls Gemini once with the full category list, then writes the extracted
// values back to the entry's `extracted` map via firebase-admin (which
// bypasses Firestore rules — see firebase-admin.ts for why that's
// necessary).
//
// We return the extracted map so the caller could optimistically apply it,
// but in practice the snapshot listener on the room page will pick up
// the updated entry doc within a tick anyway.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { extractFields } from "@/lib/gemini";
import { ExtractRequestSchema } from "@/lib/schemas";
import { METADATA_KEYS } from "@/lib/types";

// Vercel Pro caps route handlers at 60s; Hobby at 10s. Single-entry
// extract is well under either limit (~1-2s typical), but set the hint
// so we don't get blindsided when Vercel tightens defaults.
export const maxDuration = 30;

// Force the Node.js runtime — firebase-admin uses Node-only APIs (Buffer,
// crypto, etc.) so we can't run on Edge.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { roomId, entryId, drivel, categories } = parsed.data;

  // Skip metadata categories — those don't go through Gemini.
  const extractable = categories.filter((c) => !METADATA_KEYS.has(c.key));

  if (extractable.length === 0) {
    return Response.json({ extracted: {}, processed: 0 });
  }

  let extractedMap: Record<string, string | string[] | null>;
  try {
    extractedMap = await extractFields(drivel, extractable);
  } catch (err) {
    console.error("[/api/extract] gemini failed", err);
    // Don't drop the entry — mark every cell as errored so the row stays
    // visible. The user can re-trigger from the cell-level retry (later
    // feature).
    const db = getAdminDb();
    const writes: Record<string, unknown> = {};
    for (const c of extractable) {
      writes[`extracted.${c.key}`] = {
        value: null,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
    await db.doc(`rooms/${roomId}/entries/${entryId}`).update(writes);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "gemini failed",
      },
      { status: 502 },
    );
  }

  // Build the dot-path update payload — one Firestore field-path per cell
  // so we don't clobber other concurrent writes (e.g. a re-extraction job
  // updating a different category at the same instant).
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
  // Touch a server timestamp for audit purposes (ignored by app code).
  writes._lastExtractedAt = FieldValue.serverTimestamp();

  const db = getAdminDb();
  await db.doc(`rooms/${roomId}/entries/${entryId}`).update(writes);

  return Response.json({
    extracted: extractedMap,
    processed: extractable.length,
  });
}
