import type { SolverMode } from "../solver.js";

const MODES: { value: SolverMode; label: string; hint: string; badge?: string }[] = [
  {
    value: "maximum-food",
    label: "Pinaka Sulit",
    hint: "Best value — pinakamaraming pagkain para sa perang ginastos, hindi ang pinakamura",
    badge: "Default",
  },
  { value: "feed-everyone", label: "Pinaka Mura", hint: "Cheapest way everyone still gets a full meal" },
  { value: "cheapest-possible", label: "Cheapest Possible", hint: "Lowest total spend, even if it can't cover everyone" },
];

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
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium text-ink">
          Magkano ang budget mo?
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-display text-lg font-semibold text-ink-muted">
            ₱
          </span>
          <input
            id="budget"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value)}
            placeholder="300"
            className="w-full rounded-lg border border-line bg-paper py-3 pr-4 pl-9 font-display text-lg text-ink
                       focus:border-peso"
          />
        </div>
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
          step={1}
          value={headcount}
          onChange={(e) => onHeadcountChange(e.target.value)}
          placeholder="4"
          className="w-full rounded-lg border border-line bg-paper px-4 py-3 font-display text-lg text-ink
                     focus:border-peso"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">Mode</span>
        <div className="grid grid-cols-1 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              aria-pressed={mode === m.value}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                mode === m.value
                  ? "border-peso bg-peso-soft"
                  : "border-line bg-paper hover:border-ink-muted"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="block font-semibold text-ink">{m.label}</span>
                {m.badge && (
                  <span className="rounded border border-peso px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-peso uppercase">
                    {m.badge}
                  </span>
                )}
              </span>
              <span className="block text-sm text-ink-muted">{m.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
