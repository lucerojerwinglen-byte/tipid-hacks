import { useLocale } from "../i18n/LocaleContext.js";

// PRD.md §4 should-have: simple dietary filters. Tag system, not a full flavor taxonomy —
// deliberately just the three the brief named (Section 4).
const FILTER_TAGS = ["pork", "beef", "spicy"] as const;

interface DietaryFiltersProps {
  excludedTags: string[];
  onChange: (tags: string[]) => void;
}

export function DietaryFilters({ excludedTags, onChange }: DietaryFiltersProps) {
  const { t } = useLocale();

  function toggle(tag: string) {
    onChange(
      excludedTags.includes(tag) ? excludedTags.filter((t) => t !== tag) : [...excludedTags, tag],
    );
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 block text-sm font-medium text-ink">{t.dietaryLegend}</legend>
      <div className="flex flex-wrap gap-2">
        {FILTER_TAGS.map((tag) => {
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
              {t.dietary[tag]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
