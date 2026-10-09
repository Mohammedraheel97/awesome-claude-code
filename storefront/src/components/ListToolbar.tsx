import { SORT_OPTIONS, type SortOption } from '@/lib/commerce/types';
import { t, type Locale } from '@/lib/i18n';

type Props = {
  locale: Locale;
  action: string;
  hidden?: Record<string, string>;
  sort: SortOption;
  availableOnly: boolean;
  count: number;
};

const SORT_LABEL_KEY: Record<SortOption, 'featured' | 'bestSelling' | 'priceAsc' | 'priceDesc' | 'newest' | 'titleAz'> = {
  featured: 'featured',
  'best-selling': 'bestSelling',
  'price-asc': 'priceAsc',
  'price-desc': 'priceDesc',
  newest: 'newest',
  title: 'titleAz',
};

/** GET form for sorting and filtering. Works without JavaScript; state lives in the URL. */
export function ListToolbar({ locale, action, hidden = {}, sort, availableOnly, count }: Props) {
  const strings = t(locale);
  return (
    <div className="toolbar">
      <form action={action} method="get">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div>
          <label className="field-label" htmlFor="sort">
            {strings.collection.sortBy}
          </label>
          <select id="sort" name="sort" className="field" defaultValue={sort}>
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {strings.collection[SORT_LABEL_KEY[option]]}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" name="available" value="1" defaultChecked={availableOnly} />
          {strings.collection.availableOnly}
        </label>
        <button type="submit" className="button button--outline button--small">
          {strings.collection.apply}
        </button>
      </form>
      <p className="muted" style={{ margin: 0 }}>
        {strings.collection.count(count)}
      </p>
    </div>
  );
}
