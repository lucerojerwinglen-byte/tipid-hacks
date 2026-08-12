// Stage 4 (LLM parse) of DATA-PIPELINE.md §2. Groq via structured outputs (free tier —
// see DATA-PIPELINE.md §4), used here specifically because it's resilient to page-layout
// redesigns in a way CSS-selector scraping isn't.

import Groq, { APIError, RateLimitError } from "groq-sdk";
import { z } from "zod";
import type { ExtractedItem, ExtractionResult } from "./types.js";

// Of the models this account can reach, only the gpt-oss pair and llama-3.1-8b-instant support
// response_format: json_schema at all (llama-3.3-70b-versatile rejects it outright) — checked
// directly against the Groq API's own error responses, not docs, since free-tier support and
// limits vary per org and aren't reliably documented. gpt-oss-120b is the largest/most capable
// of that set and carries the highest free-tier tokens-per-minute budget of the three (8,000
// TPM vs 6,000 for llama-3.1-8b-instant).
const MODEL = "openai/gpt-oss-120b";

// Free-tier TPM counts requested max_completion_tokens against the same per-minute budget as
// the input, so a single request covering a whole menu page (which can need tens of thousands
// of output tokens) blows straight through it. Chunking the input keeps each request's
// input + max_completion_tokens comfortably under MODEL's 8,000 TPM limit.
const MAX_COMPLETION_TOKENS = 6000;
// 3000 was tuned against Milestone 4's third-party menu pages, which pad each item with
// descriptive text. KFC's official menu (Milestone 5) is far denser — mostly bare
// "NAME\n₱PRICE" lines — so a 3000-char chunk there can hold 40+ items, and the JSON needed to
// represent all of them no longer fits in MAX_COMPLETION_TOKENS (finish_reason "length",
// discovered running the real Milestone-5 pipeline). A smaller char limit bounds items-per-chunk
// directly, which is what actually drives output size, not input size.
const CHUNK_CHAR_LIMIT = 1200;

const CATEGORIES = ["main", "rice", "side", "drink", "dessert", "combo"] as const;

const comboComponentSchema = z.object({
  name: z.string(),
  qty: z.number().int().positive(),
});

const extractedItemSchema = z.object({
  name: z.string(),
  category: z.enum(CATEGORIES),
  price: z.number().int(),
  serves: z.number().int(),
  main_servings: z.number().int(),
  carb_servings: z.number().int(),
  shareable: z.boolean(),
  is_combo: z.boolean(),
  combo_component_names: z.array(comboComponentSchema),
  tags: z.array(z.string()),
  available: z.boolean(),
});

const extractionResultSchema = z.object({
  items: z.array(extractedItemSchema),
});

// Hand-written JSON Schema (structured-outputs constraints: no minLength/minimum, every
// property required, additionalProperties: false throughout — see the claude-api skill).
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Menu item name as displayed on the page." },
          category: { type: "string", enum: CATEGORIES },
          price: { type: "integer", description: "Price in pesos, no currency symbol or comma." },
          serves: {
            type: "integer",
            description:
              "How many people this item serves. Parse from the name/description (e.g. '6-pc Bucket' -> 6). Default 1 for a regular single-serve item.",
          },
          main_servings: {
            type: "integer",
            description: "Contribution to the 'main protein' coverage requirement per unit.",
          },
          carb_servings: {
            type: "integer",
            description: "Contribution to the 'rice/carb' coverage requirement per unit.",
          },
          shareable: { type: "boolean", description: "True for buckets, family meals, sharing platters." },
          is_combo: {
            type: "boolean",
            description: "True if this is a combo/meal bundling other menu items together.",
          },
          combo_component_names: {
            type: "array",
            description:
              "Only for is_combo items: the names of the component items (as they appear elsewhere in this same items array) and how many of each. Empty array if not a combo.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                qty: { type: "integer" },
              },
              required: ["name", "qty"],
              additionalProperties: false,
            },
          },
          tags: {
            type: "array",
            description: "Dietary/flavor tags drawn from the item, e.g. chicken, beef, pork, spicy.",
            items: { type: "string" },
          },
          available: {
            type: "boolean",
            description: "False only if the page explicitly marks the item as unavailable/out of stock.",
          },
        },
        required: [
          "name",
          "category",
          "price",
          "serves",
          "main_servings",
          "carb_servings",
          "shareable",
          "is_combo",
          "combo_component_names",
          "tags",
          "available",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You extract a structured menu-price list from raw fast-food menu page content for the barato project (DATA-MODEL.md schema).

Rules:
- Extract every priced, orderable menu item you can find. Skip navigation, footer, and unrelated marketing copy.
- price is pesos as a plain integer (no currency symbol, no comma, no decimals — round to nearest peso if a decimal appears).
- main_servings/carb_servings: a regular single main (e.g. "1pc Chicken, no rice") has main_servings 1, carb_servings 0. The same item "with rice" has both 1. A rice-only item has main_servings 0, carb_servings 1. A drink/side/dessert has both 0.
- Only set is_combo: true when every one of its components is ALSO separately priced elsewhere in this same extraction — in that case combo_component_names must list each one by the exact name it has as its own item, and main_servings/carb_servings/serves must equal the SUM of those components' own values. If a bundle's components are not separately priced anywhere in this content (e.g. a "Big Mac Meal" price with no separate "Big Mac" price listed on its own), it is NOT decomposable here: set is_combo: false, combo_component_names: [], and estimate main_servings/carb_servings/serves directly from what the bundle itself contains.
- shareable is true only for genuinely multi-person items (buckets, family meals, party platters), not for a large single-serve drink or fries.
- Do not fabricate items, prices, or serving counts that aren't actually present in the content.`;

/** Splits on paragraph breaks (each menu item is its own block after stripHtmlNoise) so a
 * chunk boundary never lands mid-item; hard-slices the rare oversized paragraph as a fallback. */
function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).flatMap((p) => {
    if (p.length <= CHUNK_CHAR_LIMIT) return [p];
    const pieces: string[] = [];
    for (let i = 0; i < p.length; i += CHUNK_CHAR_LIMIT) pieces.push(p.slice(i, i + CHUNK_CHAR_LIMIT));
    return pieces;
  });

  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > CHUNK_CHAR_LIMIT) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Groq's free-tier TPM budget (DATA-PIPELINE.md §1's Playwright chains push more chunks per
 * chain than Milestone 4's did) can be exceeded two ways: the SDK's typed RateLimitError (HTTP
 * 429, hit *after* a request is accepted) or a plain APIError carrying HTTP 413 with body code
 * "rate_limit_exceeded" (rejected before it's even queued, because the estimated request alone
 * would exceed the per-minute budget). Both mean the same thing operationally — wait, retry —
 * so both get the same backoff instead of only the 429 shape.
 */
function isRateLimited(err: unknown): err is APIError {
  return err instanceof RateLimitError || (err instanceof APIError && (err as { error?: { code?: string } }).error?.code === "rate_limit_exceeded");
}

async function extractChunk(client: Groq, chunkText: string, label: string): Promise<ExtractedItem[]> {
  // Streamed, not a single non-streaming call: a chunk's worth of structured JSON can still
  // run long enough to risk an HTTP timeout on a non-streaming call.
  const createStream = () =>
    client.chat.completions.create({
      model: MODEL,
      stream: true,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      // gpt-oss is a reasoning model: hidden reasoning tokens are drawn from the same
      // max_completion_tokens budget as the visible JSON, so "medium" (the default) can burn
      // through the budget before any actual output is written. This is pure extraction, not
      // a task that benefits from deliberation, so keep it low.
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Chain: ${label}\n\nRaw page content:\n\n${chunkText}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "menu_extraction",
          schema: OUTPUT_SCHEMA,
          strict: true,
        },
      },
    });

  let stream;
  try {
    stream = await createStream();
  } catch (err) {
    if (isRateLimited(err)) {
      const retryAfterSeconds = Number(err.headers?.get("retry-after")) || 20;
      console.log(`  Rate limited on ${label}, waiting ${retryAfterSeconds}s before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      try {
        stream = await createStream();
      } catch (retryErr) {
        if (!isRateLimited(retryErr)) throw retryErr;
        // Still limited (a chain with many chunks, e.g. Shakey's 11-page fetch, can outpace a
        // single retry) — one more wait, doubled, then give up rather than retry forever.
        const secondRetryAfterSeconds = Number(retryErr.headers?.get("retry-after")) || retryAfterSeconds * 2;
        console.log(`  Still rate limited on ${label}, waiting ${secondRetryAfterSeconds}s before final retry...`);
        await new Promise((resolve) => setTimeout(resolve, secondRetryAfterSeconds * 1000));
        stream = await createStream();
      }
    } else {
      throw err;
    }
  }

  let text = "";
  let finishReason: string | null = null;
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? "";
    finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
  }

  if (finishReason === "length") {
    throw new Error(
      `Extraction for ${label} hit the max_completion_tokens limit before finishing — lower CHUNK_CHAR_LIMIT or raise MAX_COMPLETION_TOKENS in extract.ts.`,
    );
  }

  if (finishReason && finishReason !== "stop") {
    throw new Error(`Extraction for ${label} ended abnormally (finish_reason: ${finishReason}).`);
  }

  if (!text) {
    throw new Error(`No text content in extraction response for ${label}. finish_reason=${finishReason}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Extraction output for ${label} was not valid JSON: ${(err as Error).message}`);
  }

  const result: ExtractionResult = extractionResultSchema.parse(parsed);
  return result.items;
}

export async function extractItems(rawText: string, chainName: string): Promise<ExtractedItem[]> {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const chunks = chunkText(rawText);

  const allItems: ExtractedItem[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const label = chunks.length > 1 ? `${chainName} (chunk ${index + 1}/${chunks.length})` : chainName;
    if (chunks.length > 1) console.log(`  Extracting ${label} (${chunk.length.toLocaleString()} chars)...`);
    allItems.push(...(await extractChunk(client, chunk, label)));
  }
  return allItems;
}
