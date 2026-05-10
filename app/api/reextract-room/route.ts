// POST /api/reextract-room
//
// Body: { roomId, categoryKey }
//
// Re-extracts ONE column over EVERY entry in the room. Triggered when a
// new column is added; could also be reused as a manual "refresh column"
// action later.
//
// Pipeline:
//   1. Read the category doc to get its spec (label, description, type).
//   2. Read all entries in the room.
//   3. For each entry, extract the field (with concurrency 5 to keep the
//      Gemini request rate well under the 15 RPM free-tier cap).
//   4. Write per-cell results: status "ok" + value, or status "error" +
//      message. Per-entry try/catch so one failure doesn't kill the rest.
//
// Pace tradeoff: at concurrency 5, ~1s per Gemini call → ~10s for 50
// entries. Comfortably within Vercel's 60s Pro / 30s Hobby ceilings up
// to a few hundred entries. Beyond that, kick this to a Cloud Function.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { extractFields } from "@/lib/gemini";
import { ReextractRoomRequestSchema } from "@/lib/schemas";
import type { CategorySpec } from "@/lib/types";
import { METADATA_KEYS } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const CONCURRENCY = 5;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = ReextractRoomRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { roomId, categoryKey } = parsed.data;

  // Refuse to re-extract metadata columns — they aren't extracted in the
  // first place.
  if (METADATA_KEYS.has(categoryKey)) {
    return Response.json(
      { error: "metadata column — nothing to extract" },
      { status: 400 },
    );
  }

  const db = getAdminDb();

  const categoryDoc = await db
    .doc(`rooms/${roomId}/categories/${categoryKey}`)
    .get();
  if (!categoryDoc.exists) {
    return Response.json({ error: "category not found" }, { status: 404 });
  }
  const cat = categoryDoc.data() as {
    key: string;
    label: string;
    description?: string;
    type: "string" | "string_array";
  };
  const spec: CategorySpec = {
    key: cat.key,
    label: cat.label,
    description: cat.description,
    type: cat.type,
  };

  const entriesSnap = await db.collection(`rooms/${roomId}/entries`).get();
  if (entriesSnap.empty) {
    return Response.json({ processed: 0, failed: 0 });
  }

  // Tiny ad-hoc semaphore — avoids pulling p-limit for one use.
  let processed = 0;
  let failed = 0;
  const docs = entriesSnap.docs.slice();
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (docs.length > 0) {
          const d = docs.shift();
          if (!d) return;
          try {
            const drivel = String(d.get("drivel") ?? "");
            if (!drivel) {
              await d.ref.update({
                [`extracted.${categoryKey}`]: {
                  value: null,
                  status: "error",
                  errorMessage: "Entry has no drivel text",
                },
                _lastExtractedAt: FieldValue.serverTimestamp(),
              });
              failed++;
              continue;
            }
            const result = await extractFields(drivel, [spec]);
            await d.ref.update({
              [`extracted.${categoryKey}`]: {
                value: result[categoryKey] ?? null,
                status: "ok",
                extractedAt: Date.now(),
              },
              _lastExtractedAt: FieldValue.serverTimestamp(),
            });
            processed++;
          } catch (err) {
            console.error(
              `[/api/reextract-room] entry ${d.id} failed`,
              err,
            );
            try {
              await d.ref.update({
                [`extracted.${categoryKey}`]: {
                  value: null,
                  status: "error",
                  errorMessage:
                    err instanceof Error ? err.message : String(err),
                },
              });
            } catch (writeErr) {
              console.error(
                `[/api/reextract-room] could not write error status for ${d.id}`,
                writeErr,
              );
            }
            failed++;
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  return Response.json({ processed, failed });
}
