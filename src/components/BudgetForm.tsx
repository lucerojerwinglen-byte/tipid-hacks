import { useState } from "react";
import type { Dictionary } from "../i18n/dictionary.js";
import { useLocale } from "../i18n/LocaleContext.js";
import type { SolverMode } from "../solver.js";

const MAX_BUDGET = 100_000;
const MAX_HEADCOUNT = 100;

function budgetError(value: string, t: Dictionary): string | null {
  if (value === "") return t.budgetError.required;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return t.budgetError.mustBePositive;
  if (n > MAX_BUDGET) return t.budgetError.max(MAX_BUDGET.toLocaleString("en-PH"));
  return null;
}

function headcountError(value: string, t: Dictionary): string | null {
  if (value === "") return t.headcountError.required;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return t.headcountError.mustBeWholeNumber;
  if (n > MAX_HEADCOUNT) return t.headcountError.max(MAX_HEADCOUNT);
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
  const { t } = useLocale();
  const [touched, setTouched] = useState({ budget: false, headcount: false });

  const budgetMsg = touched.budget ? budgetError(budget, t) : null;
  const headcountMsg = touched.headcount ? headcountError(headcount, t) : null;

  // Sulit listed first — it's the app's default mode (App.tsx, ADR 0001), not an equal option
  // among three.
  const modes: { value: SolverMode; label: string; hint: string }[] = [
    { value: "maximum-food", ...t.modes.maximumFood },
    { value: "feed-everyone", ...t.modes.feedEveryone },
    { value: "cheapest-possible", ...t.modes.cheapestPossible },
  ];

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium text-ink">
          {t.budgetLabel}
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
          {t.headcountLabel}
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
        <legend className="mb-1 block text-sm font-medium text-ink">{t.modeLegend}</legend>
        <div className="grid grid-cols-1 gap-2">
          {modes.map((m) => (
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
