// PRD.md §4 should-have: simple dietary filters. Tag system, not a full flavor taxonomy —
// deliberately just the three the brief named (Section 4).
const FILTERS: { tag: string; label: string }[] = [
  { tag: "pork", label: "No pork" },
  { tag: "beef", label: "No beef" },
  { tag: "spicy", label: "No spicy" },
];

interface DietaryFiltersProps {
  excludedTags: string[];
  onChange: (tags: string[]) => void;
}

export function DietaryFilters({ excludedTags, onChange }: DietaryFiltersProps) {
  function toggle(tag: string) {
    onChange(
      excludedTags.includes(tag) ? excludedTags.filter((t) => t !== tag) : [...excludedTags, tag],
    );
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 block text-sm font-medium text-ink">Walang gusto?</legend>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ tag, label }) => {
          const active = excludedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={active}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-95 ${
                active
                  ? "border-stamp bg-stamp-soft text-stamp"
                  : "border-line bg-paper text-ink-muted hover:border-ink-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
