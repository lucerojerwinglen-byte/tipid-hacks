import type { ChainSolveResult, SolveResult } from "../solver.js";

function pesos(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

interface ResultsPanelProps {
  result: SolveResult;
  /** Set only in "any chain" mode — the chain this result belongs to (SOLVER.md §5). */
  chainName?: string;
  /** Set only in "any chain" mode — the next 1-2 best chains, for the "why this won" comparison. */
  runnersUp?: ChainSolveResult[];
}

export function ResultsPanel({ result, chainName, runnersUp }: ResultsPanelProps) {
  if (!result.feasible) {
    return (
      <div className="rounded-lg border border-line border-l-4 border-l-stamp bg-paper p-5">
        <p className="font-semibold text-ink">
          {pesos(result.budget)} isn't enough to feed all {result.requestedHeadcount} people here.
        </p>
        <p className="mt-1 text-ink-muted">
          Closest honest answer: this covers{" "}
          <span className="font-semibold text-ink">
            {result.peopleCovered} of {result.requestedHeadcount}
          </span>{" "}
          people, for {pesos(result.totalCost)}.
        </p>
        {result.coverageItems.length > 0 && (
          <ul className="mt-3 space-y-1 font-display text-sm text-ink">
            {result.coverageItems.map(({ item, qty }) => (
              <li key={item.id}>
                {qty}× {item.name} — {pesos(item.price * qty)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const bonusLabel = result.mode === "maximum-food" ? "Included" : "You could also add";
  const feasibleRunnerUp = runnersUp?.find((r) => r.result.feasible);

  return (
    <>
      <div className="torn-strip torn-strip--zigzag" />
      <div className="paper-grain rounded-b-lg border border-t-0 border-line bg-paper p-5 shadow-sm">
        {chainName && (
          <p className="mb-3 inline-block rounded border border-brand px-2 py-0.5 text-xs font-bold tracking-wide text-brand uppercase">
            Best deal: {chainName}
          </p>
        )}

        <ul className="divide-y divide-dashed divide-line">
          {result.coverageItems.map(({ item, qty }) => (
            <li key={item.id} className="flex items-baseline gap-2 py-2">
              <span className="text-ink">
                {qty}× {item.name}
              </span>
              <span
                aria-hidden="true"
                className="-translate-y-1 flex-1 border-b border-dotted border-line"
              />
              <span className="font-display font-medium text-ink">{pesos(item.price * qty)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-lg font-semibold text-ink">Total</span>
          <span className="highlight-stroke font-display text-lg font-bold text-ink">
            {pesos(result.totalCost)}
          </span>
        </div>
        <p className="text-sm text-ink-muted">{pesos(result.leftover)} left over</p>

        {result.savings !== null && result.savings > 0 && (
          <div className="mt-4 flex justify-start">
            <p className="-rotate-2 rounded border-2 border-stamp px-3 py-1.5 text-sm font-bold tracking-wide text-stamp uppercase">
              Matipid ka — save {pesos(result.savings)}
            </p>
          </div>
        )}

        {result.bonusItems.length > 0 && (
          <div className="mt-4 border-t border-dashed border-line pt-3">
            <p className="text-sm font-medium text-ink-muted">{bonusLabel}:</p>
            <ul className="mt-1 space-y-1 font-display text-sm text-ink-muted">
              {result.bonusItems.map(({ item, qty }) => (
                <li key={item.id}>
                  {qty}× {item.name} — {pesos(item.price * qty)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {chainName && feasibleRunnerUp && (
          <p className="mt-4 border-t border-dashed border-line pt-3 text-sm text-ink-muted">
            {result.mode === "maximum-food" ? (
              (() => {
                const valueDiff = result.totalValue - feasibleRunnerUp.result.totalValue;
                return valueDiff > 0 ? (
                  <>
                    {chainName} feeds you {valueDiff} more serving{valueDiff === 1 ? "" : "s"} than{" "}
                    {feasibleRunnerUp.chain.name} for this budget.
                  </>
                ) : (
                  <>
                    {chainName} matches {feasibleRunnerUp.chain.name} on value for this budget.
                  </>
                );
              })()
            ) : (
              <>
                {chainName} beats {feasibleRunnerUp.chain.name} by{" "}
                {pesos(feasibleRunnerUp.result.totalCost - result.totalCost)} for this group.
              </>
            )}
          </p>
        )}

        <div className="barcode mt-5" role="presentation" />
      </div>
    </>
  );
}
