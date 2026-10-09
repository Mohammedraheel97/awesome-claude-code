import type { Product, Variant } from '@/lib/commerce/types';

type Props = {
  product: Product;
  selected: Variant;
  /** Current URL search params, so option links keep unrelated params. */
  params: Record<string, string>;
  basePath: string;
  label: string;
  unavailableLabel: string;
};

/**
 * Server-rendered option picker. Each option is a link that updates the URL,
 * so variant selection works without client JavaScript and is shareable.
 */
export function VariantPicker({ product, selected, params, basePath, label, unavailableLabel }: Props) {
  if (product.options.length === 0) return null;

  return (
    <div>
      {product.options.map((option, optionIndex) => {
        const selectedValue = selected.selectedOptions[optionIndex]?.value;
        return (
          <fieldset key={option.name} className="option-group" style={{ border: 0, padding: 0, margin: '0 0 var(--space-6)' }}>
            <legend className="option-group__label">
              {option.name}: <span className="muted">{selectedValue}</span>
              <span className="visually-hidden"> — {label}</span>
            </legend>
            <div className="option-group__values">
              {option.values.map((value) => {
                const isSelected = value === selectedValue;
                const candidate = product.variants.find(
                  (v) => v.selectedOptions[optionIndex]?.value === value && v.availableForSale,
                );
                const query = new URLSearchParams({ ...params, [option.name]: value });
                // Keep the other chosen options when switching this one, if such a variant exists.
                const preferred = product.variants.find((v) =>
                  v.selectedOptions.every((so, i) =>
                    i === optionIndex
                      ? so.value === value
                      : so.value === selected.selectedOptions[i]?.value,
                  ),
                );
                if (preferred) {
                  preferred.selectedOptions.forEach((so) => query.set(so.name, so.value));
                }
                return (
                  <a
                    key={value}
                    href={`${basePath}?${query.toString()}`}
                    className="option-chip"
                    aria-current={isSelected ? 'true' : undefined}
                    aria-disabled={candidate ? undefined : 'true'}
                    title={candidate ? undefined : unavailableLabel}
                  >
                    {value}
                  </a>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
