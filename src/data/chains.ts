import { jollibee } from "./jollibee.js";
import { mcdonalds } from "./mcdonalds.js";
import { kfc } from "./kfc.js";
import { chowking } from "./chowking.js";
import { mangInasal } from "./mang-inasal.js";
import { shakeys } from "./shakeys.js";
import type { ChainData } from "../types.js";

// The six chains, in the order chosen for solver-design diversity (PRD.md §5).
export const chains: ChainData[] = [jollibee, mcdonalds, kfc, chowking, mangInasal, shakeys];

export { jollibee, mcdonalds, kfc, chowking, mangInasal, shakeys };
