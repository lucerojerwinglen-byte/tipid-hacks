// Mirrors DATA-MODEL.md §1. No solver logic lives here — just the shape of the data.

export type Category = "main" | "rice" | "side" | "drink" | "dessert" | "combo";

export type PriceConfidence = "verified" | "flagged" | "manual-override";

export interface ComboComponent {
  item_id: string;
  qty: number;
}

export interface Item {
  id: string;
  chain_id: string;
  name: string;
  category: Category;
  price: number;
  /** Display/labeling number — how many people this item is meant to serve. */
  serves: number;
  /** What the solver actually consumes: contribution to the "main" coverage requirement per unit purchased. */
  main_servings: number;
  /** Contribution to the "carb/rice" coverage requirement per unit purchased. */
  carb_servings: number;
  shareable: boolean;
  is_combo: boolean;
  combo_contents?: ComboComponent[];
  tags: string[];
  available: boolean;
  price_confidence: PriceConfidence;
}

export interface Chain {
  id: string;
  name: string;
  source_url: string;
  source_type: "official" | "third-party-aggregator";
  last_updated: string;
  notes?: string;
}

export interface ChainData {
  chain: Chain;
  items: Item[];
}
