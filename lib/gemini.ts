// Gemini integration: dynamic-schema field extraction over free-form drivel.
//
// `extractFields(drivel, categories)` → returns a map keyed by each
// category's `key`, with the extracted value or `null` (if the drivel
// doesn't mention that fact).
//
// Why dynamic schema: re-extraction over a single new column needs to ask
// Gemini for ONLY that column, not re-extract everything. Building the
// response schema at call time per-request gives us that flexibility for
// free.
//
// Why preserve `null` (vs the strip-nulls pattern in sv-nodes' parse
// route): for this app `null` is meaningful — it's "Gemini was asked but
// the drivel didn't mention this fact." Distinct from "not extracted yet"
// and rendered differently in the table ("—" vs spinner).

import "server-only";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import type { CategorySpec } from "./types";

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You extract facts about ONE PERSON from a free-form note someone wrote after meeting them.

Return a JSON object with each requested field, or null when the note
genuinely doesn't contain that fact. NEVER invent. NEVER paraphrase the
field names. NEVER guess based on the person's name or any external
knowledge — only use what is explicitly stated or near-trivially implied
by the note itself.

If the note describes multiple people, focus on the ONE person who is the
subject of the note (usually the first named, or the one most facts are
about).

For string-array fields, return [] (not null) when the note doesn't
mention any items.`;

type ExtractResult = Record<string, string | string[] | null>;

export async function extractFields(
  drivel: string,
  categories: CategorySpec[],
): Promise<ExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set on the server. See .env.local.example.",
    );
  }
  if (categories.length === 0) {
    return {};
  }

  const responseSchema = buildResponseSchema(categories);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const fieldList = categories
    .map(
      (c) =>
        `- ${c.key} (${c.type === "string_array" ? "array of strings" : "string"}): ${c.label}${c.description ? ` — ${c.description}` : ""}`,
    )
    .join("\n");

  const prompt = `Extract these fields from the note:
${fieldList}

Note:
"""
${drivel}
"""`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned non-JSON: ${raw.slice(0, 200)}${raw.length > 200 ? "…" : ""}`,
    );
  }

  return normalize(parsed, categories);
}

// Build a JSON schema where every requested category becomes a nullable
// property of the right primitive type. Required-but-nullable so the model
// always emits the key (we want explicit null over a missing field).
function buildResponseSchema(categories: CategorySpec[]): Schema {
  const properties: Record<string, Schema> = {};
  for (const c of categories) {
    if (c.type === "string_array") {
      properties[c.key] = {
        type: SchemaType.ARRAY,
        nullable: true,
        items: { type: SchemaType.STRING },
        description: c.description ?? c.label,
      };
    } else {
      properties[c.key] = {
        type: SchemaType.STRING,
        nullable: true,
        description: c.description ?? c.label,
      };
    }
  }
  return {
    type: SchemaType.OBJECT,
    properties,
    required: categories.map((c) => c.key),
  };
}

// Coerce the parsed response into the expected shape. Defensive against
// the model returning extra fields, missing keys, or wrong types.
function normalize(
  parsed: unknown,
  categories: CategorySpec[],
): ExtractResult {
  if (!parsed || typeof parsed !== "object") return {};
  const obj = parsed as Record<string, unknown>;
  const out: ExtractResult = {};
  for (const c of categories) {
    const v = obj[c.key];
    if (c.type === "string_array") {
      if (Array.isArray(v)) {
        out[c.key] = v.filter((x): x is string => typeof x === "string");
      } else if (v == null) {
        out[c.key] = null;
      } else if (typeof v === "string") {
        // Tolerate single-string answer for an array field — wrap it.
        out[c.key] = [v];
      } else {
        out[c.key] = null;
      }
    } else {
      if (typeof v === "string") {
        out[c.key] = v.length > 0 ? v : null;
      } else if (v == null) {
        out[c.key] = null;
      } else {
        // Unexpected type — coerce to null rather than throw.
        out[c.key] = null;
      }
    }
  }
  return out;
}
