// TypeScript types derived from the runtime schemas. Importing from here
// (instead of from "zod" at every site) keeps the codebase decoupled from
// the validation library's surface.

import type { z } from "zod";
import type {
  CategorySchema,
  CategorySpecSchema,
  CategoryTypeSchema,
  EntrySchema,
  ExtractedCellSchema,
  ExtractedMapSchema,
  ExtractRequestSchema,
  ReextractRoomRequestSchema,
  RoomSchema,
} from "./schemas";

export type Room = z.infer<typeof RoomSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type CategoryType = z.infer<typeof CategoryTypeSchema>;
export type CategorySpec = z.infer<typeof CategorySpecSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type ExtractedCell = z.infer<typeof ExtractedCellSchema>;
export type ExtractedMap = z.infer<typeof ExtractedMapSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
export type ReextractRoomRequest = z.infer<typeof ReextractRoomRequestSchema>;

// --- The four built-in column keys -----------------------------------------
// Two of these (PERSON_NAME) are extracted by Gemini; the other three are
// metadata, rendered straight from entry fields without going through the
// `extracted` map. Marked here so the renderer can branch cleanly.

export const BUILTIN_KEYS = {
  PERSON_NAME: "person_name",
  SUBMITTED_BY: "submitted_by",
  SUBMITTED_AT: "submitted_at",
  RAW_DRIVEL: "raw_drivel",
} as const;

export type BuiltinKey = (typeof BUILTIN_KEYS)[keyof typeof BUILTIN_KEYS];

// Categories whose values come from the entry's metadata, NOT from the
// extracted map. The renderer uses this set to skip the cell-status logic
// for these.
export const METADATA_KEYS: ReadonlySet<string> = new Set<string>([
  BUILTIN_KEYS.SUBMITTED_BY,
  BUILTIN_KEYS.SUBMITTED_AT,
  BUILTIN_KEYS.RAW_DRIVEL,
]);
