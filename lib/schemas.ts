// Runtime schemas for everything that round-trips through Firestore or the
// LLM. Used both as a parse boundary (when reading data we didn't write
// ourselves — e.g. Gemini responses, untrusted client requests on route
// handlers) and as the source of truth for TS types in lib/types.ts.
//
// Why zod and not just TypeScript: TS only checks shape at compile time.
// Firestore docs evolve, Gemini occasionally returns surprises, route
// handlers receive arbitrary JSON. zod gives us actual runtime guarantees
// on every boundary.

import { z } from "zod";

// --- Cell-level extracted value ---------------------------------------------
// Stored on every entry, keyed by category key (see ExtractedMapSchema below).
// Each cell carries its own status so the UI can show a per-cell spinner
// during re-extraction without blocking the rest of the table.
export const ExtractedCellSchema = z.object({
  // Gemini may return null when the drivel doesn't mention this fact —
  // that's MEANINGFUL ("asked, absent") and rendered as "—" in the table.
  // Distinct from "extracting…" which is the in-flight state.
  value: z.union([z.string(), z.array(z.string()), z.null()]),
  status: z.enum(["ok", "extracting", "error"]),
  // Free-form, only set when status === "error"
  errorMessage: z.string().optional(),
  // Unix ms; only set when status === "ok"
  extractedAt: z.number().optional(),
});

export const ExtractedMapSchema = z.record(z.string(), ExtractedCellSchema);

// --- Category (= one column) -----------------------------------------------
export const CategoryTypeSchema = z.enum(["string", "string_array"]);

export const CategorySchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: CategoryTypeSchema,
  builtin: z.boolean(),
  order: z.number(),
  createdBy: z.string().min(1),
  createdAt: z.number(),
  // Soft-delete timestamp. Null = active; number = unix-ms when deleted.
  // Restoring just sets it back to null. Data is never wiped — the entry's
  // extracted map keeps the column's values so restoring brings them back.
  deletedAt: z.number().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

// --- Entry (= one row) -----------------------------------------------------
export const EntrySchema = z.object({
  id: z.string(),
  drivel: z.string().min(1),
  submittedBy: z.string().min(1),
  submittedAt: z.number(),
  extracted: ExtractedMapSchema,
  deletedAt: z.number().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

// --- Room ------------------------------------------------------------------
export const RoomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.number(),
  deletedAt: z.number().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

// --- Category spec sent to Gemini ------------------------------------------
// Subset of Category — Gemini only needs to know what to extract. Used as
// the request shape for /api/extract and /api/reextract-room internally.
export const CategorySpecSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: CategoryTypeSchema,
});

// --- Wire schemas for route handlers --------------------------------------
export const ExtractRequestSchema = z.object({
  roomId: z.string().min(1),
  entryId: z.string().min(1),
  drivel: z.string().min(1),
  categories: z.array(CategorySpecSchema).min(1),
});

export const ReextractRoomRequestSchema = z.object({
  roomId: z.string().min(1),
  categoryKey: z.string().min(1),
});
