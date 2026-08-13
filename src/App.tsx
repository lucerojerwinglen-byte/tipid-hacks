import { useEffect, useMemo, useState } from "react";
import wordmark from "./assets/brand/wordmark.webp";
import { BudgetForm } from "./components/BudgetForm.js";
import { ChainSelector } from "./components/ChainSelector.js";
import { DietaryFilters } from "./components/DietaryFilters.js";
import { FreshnessIndicator } from "./components/FreshnessIndicator.js";
import { InAppBrowserBanner } from "./components/InAppBrowserBanner.js";
import { LocaleToggle } from "./components/LocaleToggle.js";
import { ResultsPanel } from "./components/ResultsPanel.js";
import { chains } from "./data/chains.js";
import { useLocale } from "./i18n/LocaleContext.js";
import { savePriceSnapshot } from "./priceCache.js";
import { excludeTags, solve, solveAnyChain, type SolverMode } from "./solver.js";

// Milestone 2 (ROADMAP.md): all six chains, "any chain" mode, dietary filters. Still
// hand-typed data — the real pipeline lands in Milestone 4/5.

export function App() {
  const { t } = useLocale();
  const [budget, setBudget] = useState("300");
  const [headcount, setHeadcount] = useState("4");
  // Default is "maximum-food" — the app's "Sulit" (best-value) mode, not the cheapest one.
  // See CONTEXT.md's Sulit/Mura terms and docs/adr/0001-sulit-default-value-per-peso.md.
  const [mode, setMode] = useState<SolverMode>("maximum-food");
  const [chainId, setChainId] = useState("any");
  const [excludedTags, setExcludedTags] = useState<string[]>([]);

  const parsedBudget = Number(budget);
  const parsedHeadcount = Number(headcount);
  const validInput =
    budget !== "" &&
    headcount !== "" &&
    Number.isFinite(parsedBudget) &&
    parsedBudget > 0 &&
    Number.isInteger(parsedHeadcount) &&
    parsedHeadcount >= 1;

  const selectedChain = chains.find((c) => c.chain.id === chainId);

  // Milestone 3 (ROADMAP.md): write-through cache so the last-seen price data survives a
  // Cache Storage eviction independently of the service worker — see priceCache.ts.
  useEffect(() => {
    void savePriceSnapshot(chains);
  }, []);

  const solved = useMemo(() => {
    if (!validInput) return null;
    const N = parsedHeadcount;
    const B = Math.floor(parsedBudget);

    if (chainId === "any") {
      const { winner, runnersUp } = solveAnyChain(chains, N, B, mode, excludedTags);
      return {
        result: winner.result,
        chainName: winner.chain.name,
        runnersUp,
        lastUpdated: winner.chain.last_updated,
      };
    }

    if (!selectedChain) return null;
    const result = solve(excludeTags(selectedChain.items, excludedTags), N, B, mode);
    return {
      result,
      chainName: undefined,
      runnersUp: undefined,
      lastUpdated: selectedChain.chain.last_updated,
    };
  }, [validInput, parsedBudget, parsedHeadcount, mode, chainId, excludedTags, selectedChain]);

  return (
    <div className="paper-grain min-h-screen bg-bg">
      <InAppBrowserBanner />

      {/* Header sits on the plain page bg (not a solid brand-color block) so the wordmark —
          teal on transparent — has the contrast it needs; see docs/adr/0003. */}
      <header className="px-4 pb-3 pt-6">
        <div className="mx-auto flex max-w-md items-start justify-between gap-3">
          <div>
            <h1>
              <img
                src={wordmark}
                alt="barato"
                width={340}
                height={81}
                className="block h-8 w-auto"
              />
            </h1>
            <p className="font-heading mt-1.5 text-sm font-semibold tracking-tight text-ink-muted">
              {t.tagline}
            </p>
          </div>
          <LocaleToggle />
        </div>
      </header>

      <div className="mx-auto max-w-md px-4">
        <div className="wave-motif" role="presentation" />
      </div>

      <div className="mx-auto max-w-md px-4 pt-5 pb-10">
        <div className="torn-strip torn-strip--scallop" />
        <div className="paper-grain space-y-5 rounded-b-lg border border-t-0 border-line bg-paper p-5 shadow-sm">
          <h2 className="sr-only">{t.setupHeading}</h2>
          <ChainSelector chains={chains} selectedChainId={chainId} onChange={setChainId} />

          <BudgetForm
            budget={budget}
            headcount={headcount}
            mode={mode}
            onBudgetChange={setBudget}
            onHeadcountChange={setHeadcount}
            onModeChange={setMode}
          />

          <DietaryFilters excludedTags={excludedTags} onChange={setExcludedTags} />
        </div>

        <div className="mt-6">
          {solved ? (
            <div className="result-reveal">
              <h2 className="sr-only">{t.resultsHeading}</h2>
              <FreshnessIndicator lastUpdated={solved.lastUpdated} />
              <ResultsPanel
                result={solved.result}
                chainName={solved.chainName}
                runnersUp={solved.runnersUp}
                lastUpdated={solved.lastUpdated}
              />
            </div>
          ) : (
            <p className="py-8 text-center text-ink-muted">{t.emptyState}</p>
          )}
        </div>

        <footer className="mt-8 text-center text-xs text-ink-muted">
          <p>
            {t.footer.before} <code>DATA-PIPELINE.md</code>
            {t.footer.after}
          </p>
        </footer>
      </div>
    </div>
  );
}
