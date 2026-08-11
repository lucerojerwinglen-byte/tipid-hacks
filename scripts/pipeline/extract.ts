// Stage 4 (LLM parse) of DATA-PIPELINE.md §2. Claude Sonnet 5 via structured outputs — chosen
// over Haiku 4.5 specifically for parsing accuracy (DATA-PIPELINE.md §4), and used here
// specifically because it's resilient to page-layout redesigns in a way CSS-selector
// scraping isn't.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExtractedItem, ExtractionResult } from "./types.js";

const MODEL = "claude-sonnet-5";

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

const SYSTEM_PROMPT = `You extract a structured menu-price list from raw fast-food menu page content for the Tipid Hacks project (DATA-MODEL.md schema).

Rules:
- Extract every priced, orderable menu item you can find. Skip navigation, footer, and unrelated marketing copy.
- price is pesos as a plain integer (no currency symbol, no comma, no decimals — round to nearest peso if a decimal appears).
- main_servings/carb_servings: a regular single main (e.g. "1pc Chicken, no rice") has main_servings 1, carb_servings 0. The same item "with rice" has both 1. A rice-only item has main_servings 0, carb_servings 1. A drink/side/dessert has both 0.
- For a combo (is_combo: true), main_servings/carb_servings/serves should equal the SUM of its listed components' own values, and combo_component_names must list every component by the exact name it has elsewhere in your output items array — do not invent a name that isn't also a separate item.
- shareable is true only for genuinely multi-person items (buckets, family meals, party platters), not for a large single-serve drink or fries.
- Do not fabricate items, prices, or serving counts that aren't actually present in the content.`;

export async function extractItems(rawText: string, chainName: string): Promise<ExtractedItem[]> {
  const client = new Anthropic();

  // Streamed, not .create(): a full menu's worth of structured JSON can run well past the
  // point non-streaming requests risk an SDK HTTP timeout, and max_tokens here has to cover
  // every extracted item, not just a short answer.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Chain: ${chainName}\n\nRaw page content:\n\n${rawText}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `Extraction for ${chainName} hit the max_tokens limit before finishing — the menu is larger than expected, or the model over-extracted. Raise max_tokens in extract.ts.`,
    );
  }

  if (response.stop_reason === "refusal") {
    throw new Error(`Extraction refused by the model for ${chainName} (stop_reason: refusal).`);
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    const blockTypes = response.content.map((b) => b.type).join(", ") || "(empty)";
    throw new Error(
      `No text content in extraction response for ${chainName}. stop_reason=${response.stop_reason}, blocks=[${blockTypes}], usage=${JSON.stringify(response.usage)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `Extraction output for ${chainName} was not valid JSON: ${(err as Error).message}`,
    );
  }

  const result: ExtractionResult = extractionResultSchema.parse(parsed);
  return result.items;
}
