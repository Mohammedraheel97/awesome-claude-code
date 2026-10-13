// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState} from 'preact/hooks';

const NAMESPACE = 'custom';
const KEY = 'date_of_birth';
const MIN_YEAR = 1900;

export default function extension() {
  render(<BirthdayBlock />, document.body);
}

function BirthdayBlock() {
  const {i18n} = shopify;
  // Not available with accelerated checkouts such as Apple Pay or Google Pay.
  const canSet = shopify.instructions.value.metafields.canSetCartMetafields;

  const existing = shopify.appMetafields.value.find(
    ({metafield}) => metafield.namespace === NAMESPACE && metafield.key === KEY
  )?.metafield.value;

  const [savedValue, setSavedValue] = useState(existing ?? '');
  const [editing, setEditing] = useState(!existing);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!canSet) {
    return null;
  }

  const handleSave = async () => {
    const iso = toIsoDate(month, day, year);
    if (!iso) {
      setError(i18n.translate('invalid'));
      return;
    }

    setSaving(true);
    setError('');
    const result = await shopify.applyMetafieldChange({
      type: 'updateCartMetafield',
      metafield: {
        namespace: NAMESPACE,
        key: KEY,
        type: 'date',
        value: iso,
      },
    });
    setSaving(false);

    if (result.type === 'error') {
      setError(i18n.translate('saveFailed'));
      return;
    }
    setSavedValue(iso);
    setEditing(false);
  };

  if (!editing && savedValue) {
    return (
      <s-banner tone="success">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text>
            {i18n.translate('saved', {date: formatDate(i18n, savedValue)})}
          </s-text>
          <s-button variant="secondary" onClick={() => setEditing(true)}>
            {i18n.translate('change')}
          </s-button>
        </s-stack>
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      <s-heading>{i18n.translate('heading')}</s-heading>
      <s-text>{i18n.translate('description')}</s-text>
      <s-grid gridTemplateColumns="1fr 1fr 1.5fr" gap="base">
        <s-number-field
          label={i18n.translate('month')}
          inputMode="numeric"
          controls="none"
          min={1}
          max={12}
          value={month}
          error={error || undefined}
          onInput={(e) => setMonth(e.currentTarget.value)}
        />
        <s-number-field
          label={i18n.translate('day')}
          inputMode="numeric"
          controls="none"
          min={1}
          max={31}
          value={day}
          onInput={(e) => setDay(e.currentTarget.value)}
        />
        <s-number-field
          label={i18n.translate('year')}
          inputMode="numeric"
          controls="none"
          min={MIN_YEAR}
          value={year}
          onInput={(e) => setYear(e.currentTarget.value)}
        />
      </s-grid>
      <s-button variant="primary" loading={saving} onClick={handleSave}>
        {i18n.translate('save')}
      </s-button>
    </s-stack>
  );
}

const pad = (n) => String(n).padStart(2, '0');

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Returns YYYY-MM-DD for a real calendar date between 1900 and today, else null.
function toIsoDate(month, day, year) {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);
  if (![m, d, y].every(Number.isInteger) || String(year).length !== 4) {
    return null;
  }
  if (y < MIN_YEAR || m < 1 || m > 12 || d < 1) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  // YYYY-MM-DD strings sort the same as dates.
  return iso <= todayIso() ? iso : null;
}

function formatDate(i18n, value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  try {
    // UTC keeps the shown day from shifting with the buyer's time zone.
    return i18n.formatDate(date, {dateStyle: 'long', timeZone: 'UTC'});
  } catch {
    return value;
  }
}
