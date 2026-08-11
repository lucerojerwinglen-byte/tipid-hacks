import { useEffect, useMemo, useState } from "react";
import { BudgetForm } from "./components/BudgetForm.js";
import { ChainSelector } from "./components/ChainSelector.js";
import { DietaryFilters } from "./components/DietaryFilters.js";
import { FreshnessIndicator } from "./components/FreshnessIndicator.js";
import { InAppBrowserBanner } from "./components/InAppBrowserBanner.js";
import { ResultsPanel } from "./components/ResultsPanel.js";
import { chains } from "./data/chains.js";
import { savePriceSnapshot } from "./priceCache.js";
import { excludeTags, solve, solveAnyChain, type SolverMode } from "./solver.js";

// Milestone 2 (ROADMAP.md): all six chains, "any chain" mode, dietary filters. Still
// hand-typed data — the real pipeline lands in Milestone 4/5.

export function App() {
  const [budget, setBudget] = useState("300");
  const [headcount, setHeadcount] = useState("4");
  // Default to the best-value order ("Pinaka Sulit"), not the cheapest one — see solver.ts's
  // SolverMode doc comment. Users can still opt into "Pinaka Mura" (feed-everyone) explicitly.
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
    <div className="min-h-screen bg-bg">
      <InAppBrowserBanner />

      <header className="bg-peso px-4 pb-5 pt-6 text-paper">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-bold tracking-tight uppercase">Tipid Hacks</h1>
          <p className="mt-0.5 text-sm text-peso-soft">
            Presyo checker — para malaman kung ano ang kayang-kaya
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-5 pb-10">
        <div className="torn-strip torn-strip--scallop" />
        <div className="space-y-5 rounded-b-lg border border-t-0 border-line bg-paper p-5 shadow-sm">
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
            <>
              <FreshnessIndicator lastUpdated={solved.lastUpdated} />
              <ResultsPanel
                result={solved.result}
                chainName={solved.chainName}
                runnersUp={solved.runnersUp}
              />
            </>
          ) : (
            <p className="py-8 text-center text-ink-muted">
              Ilagay ang budget at bilang ng kakain para makita ang order mo.
            </p>
          )}
        </div>

        <footer className="mt-8 text-center text-xs text-ink-muted">
          <p>
            Prices are illustrative Milestone-0/1/2 placeholder data, not live prices — see{" "}
            <code>DATA-PIPELINE.md</code>. Unofficial, not affiliated with or endorsed by any
            chain shown.
          </p>
        </footer>
      </div>
    </div>
  );
}
