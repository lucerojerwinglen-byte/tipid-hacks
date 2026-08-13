import { useLocale } from "../i18n/LocaleContext.js";
import type { ChainData } from "../types.js";

interface ChainSelectorProps {
  chains: ChainData[];
  selectedChainId: string; // "any" | chain.id
  onChange: (chainId: string) => void;
}

export function ChainSelector({ chains, selectedChainId, onChange }: ChainSelectorProps) {
  const { t } = useLocale();

  return (
    <div>
      <label htmlFor="chain" className="mb-1 block text-sm font-medium text-ink">
        {t.chainSelectorLabel}
      </label>
      <select
        id="chain"
        value={selectedChainId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-4 py-3 text-lg text-ink
                   transition-colors focus:border-brand"
      >
        <option value="any">{t.anyChainOption}</option>
        {chains.map((c) => (
          <option key={c.chain.id} value={c.chain.id}>
            {c.chain.name}
          </option>
        ))}
      </select>
    </div>
  );
}
