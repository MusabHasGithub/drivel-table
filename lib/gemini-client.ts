"use client";

// Client-side Gemini wrapper for the GitHub Pages build.
//
// We can't use the server-side `lib/gemini.ts` because static export means
// no Node.js runtime — there's nowhere for the secret to live. Instead we
// expose the key as `NEXT_PUBLIC_GEMINI_API_KEY` (which Next bakes into
// the JS bundle at build time) and rely on Google Cloud's HTTP-referrer
// restriction to make the key useless if scraped from devtools by anyone
// not loading the page from `musabhasgithub.github.io`.
//
// Same dynamic-schema extraction trick as the server version — build a
// JSON response schema per call from the requested categories, ask Gemini
// for `null` when the drivel doesn't mention something, preserve nulls
// (don't strip) so the table can render "—" distinct from "extracting…".

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

export type ExtractResult = Record<string, string | string[] | null>;

export async function extractFieldsClient(
  drivel: string,
  categories: CategorySpec[],
): Promise<ExtractResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_GEMINI_API_KEY is not set. See .env.local.example.",
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
        out[c.key] = null;
      }
    }
  }
  return out;
}

// Tiny ad-hoc concurrency limiter — same pattern used server-side, in
// the browser this is mostly a courtesy to Gemini's RPM cap (15/min on
// the free tier; 5 in flight stays comfortable).
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx]);
      } catch (err) {
        console.error("[runWithConcurrency] item failed", err);
      }
    }
  });
  await Promise.all(workers);
}
