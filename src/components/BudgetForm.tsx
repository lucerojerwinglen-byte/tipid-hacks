import { useState } from "react";
import type { SolverMode } from "../solver.js";

// Sulit listed first — it's the app's default mode (App.tsx, ADR 0001), not an equal option
// among three.
const MODES: { value: SolverMode; label: string; hint: string }[] = [
  { value: "maximum-food", label: "Sulit", hint: "Pinaka sulit — max value para sa budget mo" },
  { value: "feed-everyone", label: "Feed Everyone", hint: "Cheapest way everyone gets a full meal" },
  { value: "cheapest-possible", label: "Cheapest Possible", hint: "Lowest total spend, even if it can't cover everyone" },
];

const MAX_BUDGET = 100_000;
const MAX_HEADCOUNT = 100;

function budgetError(value: string): string | null {
  if (value === "") return "Kailangan ng budget.";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Kailangan ng budget na mas malaki sa 0.";
  if (n > MAX_BUDGET) return `Pinakamataas na budget: ₱${MAX_BUDGET.toLocaleString("en-PH")}.`;
  return null;
}

function headcountError(value: string): string | null {
  if (value === "") return "Kailangan ng bilang ng kakain.";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return "Kailangan ng buong bilang, 1 pataas.";
  if (n > MAX_HEADCOUNT) return `Pinakamataas na bilang: ${MAX_HEADCOUNT}.`;
  return null;
}

interface BudgetFormProps {
  budget: string;
  headcount: string;
  mode: SolverMode;
  onBudgetChange: (value: string) => void;
  onHeadcountChange: (value: string) => void;
  onModeChange: (mode: SolverMode) => void;
}

export function BudgetForm({
  budget,
  headcount,
  mode,
  onBudgetChange,
  onHeadcountChange,
  onModeChange,
}: BudgetFormProps) {
  const [touched, setTouched] = useState({ budget: false, headcount: false });

  const budgetMsg = touched.budget ? budgetError(budget) : null;
  const headcountMsg = touched.headcount ? headcountError(headcount) : null;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium text-ink">
          Magkano ang budget mo?
        </label>
        <div className="relative">
          <span
            id="budget-currency"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-display text-lg font-semibold text-ink-muted"
          >
            ₱
          </span>
          <input
            id="budget"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_BUDGET}
            step={1}
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, budget: true }))}
            placeholder="300"
            aria-invalid={budgetMsg ? true : undefined}
            aria-describedby={budgetMsg ? "budget-error" : "budget-currency"}
            className={`w-full rounded-lg border bg-paper py-3 pr-4 pl-9 font-display text-lg text-ink
                       transition-colors focus:border-brand ${budgetMsg ? "border-stamp" : "border-line"}`}
          />
        </div>
        {budgetMsg && (
          <p id="budget-error" role="alert" className="mt-1 text-sm font-medium text-stamp">
            {budgetMsg}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="headcount" className="mb-1 block text-sm font-medium text-ink">
          Ilan kayong kakain?
        </label>
        <input
          id="headcount"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_HEADCOUNT}
          step={1}
          value={headcount}
          onChange={(e) => onHeadcountChange(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, headcount: true }))}
          placeholder="4"
          aria-invalid={headcountMsg ? true : undefined}
          aria-describedby={headcountMsg ? "headcount-error" : undefined}
          className={`w-full rounded-lg border bg-paper px-4 py-3 font-display text-lg text-ink
                     transition-colors focus:border-brand ${headcountMsg ? "border-stamp" : "border-line"}`}
        />
        {headcountMsg && (
          <p id="headcount-error" role="alert" className="mt-1 text-sm font-medium text-stamp">
            {headcountMsg}
          </p>
        )}
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 block text-sm font-medium text-ink">Mode</legend>
        <div className="grid grid-cols-1 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              aria-pressed={mode === m.value}
              className={`rounded-lg border px-4 py-3 text-left transition-colors active:scale-[0.98] ${
                mode === m.value
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-paper hover:border-ink-muted"
              }`}
            >
              <span className="block font-semibold text-ink">{m.label}</span>
              <span className="block text-sm text-ink-muted">{m.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
