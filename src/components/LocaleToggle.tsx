import { useLocale } from "../i18n/LocaleContext.js";

export function LocaleToggle() {
  const { locale, t, setLocale } = useLocale();
  const next = locale === "tl" ? "en" : "tl";
  const label = locale === "tl" ? t.localeToggle.switchToEnglish : t.localeToggle.switchToTagalog;

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={label}
      className="rounded-full border border-line px-2.5 py-1 font-display text-xs font-semibold
                 text-ink-muted transition-colors hover:border-brand hover:text-brand"
    >
      {locale === "tl" ? "TL｜EN" : "EN｜TL"}
    </button>
  );
}
