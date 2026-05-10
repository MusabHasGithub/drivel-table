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
  // Stable machine name (= the doc id, = slugify(label)). Used as the key
  // in entry.extracted, so renaming a column would break re-extraction —
  // by design, columns are immutable in this MVP.
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: CategoryTypeSchema,
  // Marks the four default columns we seed on room creation. The UI uses
  // this to disable delete; we don't enforce it in rules because the rules
  // already block all client deletes anyway.
  builtin: z.boolean(),
  // Source of truth for default order. The UI may override per-user via
  // localStorage (see plan §5: "Drag-reorder column headers"), but the
  // initial render uses this.
  order: z.number(),
  createdBy: z.string().min(1),
  createdAt: z.number(),
});

// --- Entry (= one row) -----------------------------------------------------
export const EntrySchema = z.object({
  id: z.string(),
  // The original drivel text — preserved forever, this is what makes
  // re-extraction possible when a new column is added later.
  drivel: z.string().min(1),
  submittedBy: z.string().min(1),
  submittedAt: z.number(),
  extracted: ExtractedMapSchema,
});

// --- Room ------------------------------------------------------------------
export const RoomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.number(),
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
