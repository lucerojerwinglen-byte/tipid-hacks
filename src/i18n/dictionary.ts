// PRD.md §4 should-have: Tagalog/English toggle. The app's copy today is a deliberately blended
// Tagalog/English voice (CONTEXT.md), not a translation of a single source language — so `tl`
// below is a verbatim copy of every string exactly as it existed in the components before this
// toggle existed (zero regression for current users), and `en` is new copy authored for this
// pass. Where a string was already English (most of ResultsPanel, the mode labels, the dietary
// chips), both locales carry the same value on purpose — there's nothing to translate.
//
// "Sulit" is never translated (CONTEXT.md: it's the app's one true term for its default
// philosophy, not a synonym for "best deal"/"cheapest"/"best value").

export type Locale = "tl" | "en";

export interface Dictionary {
  tagline: string;
  setupHeading: string;
  resultsHeading: string;
  emptyState: string;
  footer: { before: string; after: string };

  budgetLabel: string;
  headcountLabel: string;
  modeLegend: string;
  modes: {
    maximumFood: { label: string; hint: string };
    feedEveryone: { label: string; hint: string };
    cheapestPossible: { label: string; hint: string };
  };
  budgetError: {
    required: string;
    mustBePositive: string;
    max: (maxFormatted: string) => string;
  };
  headcountError: {
    required: string;
    mustBeWholeNumber: string;
    max: (max: number) => string;
  };

  dietaryLegend: string;
  dietary: { pork: string; beef: string; spicy: string };

  chainSelectorLabel: string;
  anyChainOption: string;

  results: {
    summaryFeasible: (totalCost: string, leftover: string, chainName?: string) => string;
    summaryInfeasible: (
      budget: string,
      covered: number,
      requested: number,
      totalCost: string,
    ) => string;
    infeasibleHeadline: (budget: string, requested: number) => string;
    infeasibleBody: (covered: number, requested: number, totalCost: string) => string;
    bonusIncluded: string;
    bonusSuggested: string;
    bestDealBadge: (chainName: string) => string;
    total: string;
    leftOver: (amount: string) => string;
    savings: (amount: string) => string;
    runnerUpValue: (chainName: string, otherName: string, diff: number) => string;
    runnerUpValueTie: (chainName: string, otherName: string) => string;
    runnerUpCost: (chainName: string, otherName: string, diff: string) => string;
  };

  inAppBanner: { before: string; after: string; dismiss: string };
  freshness: { fresh: (date: string) => string; stale: (date: string) => string };
  localeToggle: { switchToEnglish: string; switchToTagalog: string };
  priceReport: { linkLabel: string };
  share: { button: string; rendering: string; error: string; downloadedNote: string };
}

const servingWord = (n: number) => (n === 1 ? "serving" : "servings");

export const tl: Dictionary = {
  tagline: "Presyo checker — para malaman kung ano ang kayang-kaya",
  setupHeading: "I-set up ang order mo",
  resultsHeading: "Resulta",
  emptyState: "Ilagay ang budget at bilang ng kakain para makita ang order mo.",
  footer: {
    before: "Prices are illustrative Milestone-0/1/2 placeholder data, not live prices — see",
    after: ". Unofficial, not affiliated with or endorsed by any chain shown.",
  },

  budgetLabel: "Magkano ang budget mo?",
  headcountLabel: "Ilan kayong kakain?",
  modeLegend: "Mode",
  modes: {
    maximumFood: { label: "Sulit", hint: "Pinaka sulit — max value para sa budget mo" },
    feedEveryone: { label: "Feed Everyone", hint: "Cheapest way everyone gets a full meal" },
    cheapestPossible: {
      label: "Cheapest Possible",
      hint: "Lowest total spend, even if it can't cover everyone",
    },
  },
  budgetError: {
    required: "Kailangan ng budget.",
    mustBePositive: "Kailangan ng budget na mas malaki sa 0.",
    max: (maxFormatted) => `Pinakamataas na budget: ₱${maxFormatted}.`,
  },
  headcountError: {
    required: "Kailangan ng bilang ng kakain.",
    mustBeWholeNumber: "Kailangan ng buong bilang, 1 pataas.",
    max: (max) => `Pinakamataas na bilang: ${max}.`,
  },

  dietaryLegend: "Walang gusto?",
  dietary: { pork: "No pork", beef: "No beef", spicy: "No spicy" },

  chainSelectorLabel: "Saan?",
  anyChainOption: "Any chain (best deal wins)",

  results: {
    summaryFeasible: (totalCost, leftover, chainName) =>
      `Order updated. Total ${totalCost}, ${leftover} left over.` +
      (chainName ? ` Best deal: ${chainName}.` : ""),
    summaryInfeasible: (budget, covered, requested, totalCost) =>
      `Order updated. ${budget} covers ${covered} of ${requested} people, ${totalCost}.`,
    infeasibleHeadline: (budget, requested) =>
      `${budget} isn't enough to feed all ${requested} people here.`,
    infeasibleBody: (covered, requested, totalCost) =>
      `Closest honest answer: this covers ${covered} of ${requested} people, for ${totalCost}.`,
    bonusIncluded: "Included",
    bonusSuggested: "You could also add",
    bestDealBadge: (chainName) => `Best deal: ${chainName}`,
    total: "Total",
    leftOver: (amount) => `${amount} left over`,
    savings: (amount) => `Matipid ka — save ${amount}`,
    runnerUpValue: (chainName, otherName, diff) =>
      `${chainName} feeds you ${diff} more ${servingWord(diff)} than ${otherName} for this budget.`,
    runnerUpValueTie: (chainName, otherName) =>
      `${chainName} matches ${otherName} on value for this budget.`,
    runnerUpCost: (chainName, otherName, diff) =>
      `${chainName} beats ${otherName} by ${diff} for this group.`,
  },

  inAppBanner: {
    before:
      "For the full experience (and to save this app to your home screen), open this page in Safari or Chrome using the",
    after: "menu.",
    dismiss: "Dismiss",
  },
  freshness: {
    fresh: (date) => `Prices as of ${date}`,
    stale: (date) => `Prices as of ${date} — might be a little out of date`,
  },
  localeToggle: {
    switchToEnglish: "Palitan sa English",
    switchToTagalog: "Manatili sa Tagalog",
  },
  priceReport: { linkLabel: "Mali ang presyo?" },
  share: {
    button: "I-share ang resulta",
    rendering: "Ginagawa ang larawan…",
    error: "Hindi na-share. Subukan ulit.",
    downloadedNote: "Na-download ang larawan.",
  },
};

export const en: Dictionary = {
  tagline: "Price checker — know what you can actually afford",
  setupHeading: "Set up your order",
  resultsHeading: "Result",
  emptyState: "Enter your budget and headcount to see your order.",
  footer: {
    before: "Prices are illustrative Milestone-0/1/2 placeholder data, not live prices — see",
    after: ". Unofficial, not affiliated with or endorsed by any chain shown.",
  },

  budgetLabel: "What's your budget?",
  headcountLabel: "How many people are eating?",
  modeLegend: "Mode",
  modes: {
    maximumFood: { label: "Sulit", hint: "Best value — the most food for your budget" },
    feedEveryone: { label: "Feed Everyone", hint: "Cheapest way everyone gets a full meal" },
    cheapestPossible: {
      label: "Cheapest Possible",
      hint: "Lowest total spend, even if it can't cover everyone",
    },
  },
  budgetError: {
    required: "Budget is required.",
    mustBePositive: "Budget must be greater than 0.",
    max: (maxFormatted) => `Maximum budget: ₱${maxFormatted}.`,
  },
  headcountError: {
    required: "Headcount is required.",
    mustBeWholeNumber: "Must be a whole number, 1 or more.",
    max: (max) => `Maximum headcount: ${max}.`,
  },

  dietaryLegend: "Anything to avoid?",
  dietary: { pork: "No pork", beef: "No beef", spicy: "No spicy" },

  chainSelectorLabel: "Where?",
  anyChainOption: "Any chain (best deal wins)",

  results: {
    summaryFeasible: (totalCost, leftover, chainName) =>
      `Order updated. Total ${totalCost}, ${leftover} left over.` +
      (chainName ? ` Best deal: ${chainName}.` : ""),
    summaryInfeasible: (budget, covered, requested, totalCost) =>
      `Order updated. ${budget} covers ${covered} of ${requested} people, ${totalCost}.`,
    infeasibleHeadline: (budget, requested) =>
      `${budget} isn't enough to feed all ${requested} people here.`,
    infeasibleBody: (covered, requested, totalCost) =>
      `Closest honest answer: this covers ${covered} of ${requested} people, for ${totalCost}.`,
    bonusIncluded: "Included",
    bonusSuggested: "You could also add",
    bestDealBadge: (chainName) => `Best deal: ${chainName}`,
    total: "Total",
    leftOver: (amount) => `${amount} left over`,
    savings: (amount) => `You saved ${amount}`,
    runnerUpValue: (chainName, otherName, diff) =>
      `${chainName} feeds you ${diff} more ${servingWord(diff)} than ${otherName} for this budget.`,
    runnerUpValueTie: (chainName, otherName) =>
      `${chainName} matches ${otherName} on value for this budget.`,
    runnerUpCost: (chainName, otherName, diff) =>
      `${chainName} beats ${otherName} by ${diff} for this group.`,
  },

  inAppBanner: {
    before:
      "For the full experience (and to save this app to your home screen), open this page in Safari or Chrome using the",
    after: "menu.",
    dismiss: "Dismiss",
  },
  freshness: {
    fresh: (date) => `Prices as of ${date}`,
    stale: (date) => `Prices as of ${date} — might be a little out of date`,
  },
  localeToggle: {
    switchToEnglish: "Switch to English",
    switchToTagalog: "Switch to Tagalog",
  },
  priceReport: { linkLabel: "Wrong price?" },
  share: {
    button: "Share result",
    rendering: "Preparing image…",
    error: "Couldn't share. Try again.",
    downloadedNote: "Image downloaded.",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { tl, en };
