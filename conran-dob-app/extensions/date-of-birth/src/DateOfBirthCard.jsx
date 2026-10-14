// @ts-nocheck
import {render} from 'preact';
import {useState, useRef} from 'preact/hooks';

const API_URL = 'shopify:customer-account/api/2025-10/graphql.json';
const NAMESPACE = 'custom';
const KEY = 'date_of_birth';
const MIN_YEAR = 1900;

export default async () => {
  const {customerId, dateOfBirth} = await getDateOfBirth();

  render(
    <DateOfBirthCard customerId={customerId} dateOfBirth={dateOfBirth} />,
    document.body
  );
};

function DateOfBirthCard(props) {
  const {i18n} = shopify;
  const modalRef = useRef();
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(props.dateOfBirth ?? '');
  const [parts, setParts] = useState(splitDate(props.dateOfBirth ?? ''));

  const dayCount = daysInMonth(parts.year, parts.month);
  const years = Array.from(
    {length: currentYear - MIN_YEAR + 1},
    (_, index) => currentYear - index
  );

  const update = (field) => (e) => {
    const next = {...parts, [field]: e.currentTarget.value};
    // Clear a day that doesn't exist in the newly chosen month (e.g. 31 Feb).
    if (next.day && Number(next.day) > daysInMonth(next.year, next.month)) {
      next.day = '';
    }
    setParts(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const iso = toIsoDate(parts, today);
    if (!iso) {
      setError(i18n.translate('invalid'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const saved = await saveDateOfBirth(props.customerId, iso);
      setDateOfBirth(saved);
      modalRef.current?.hideOverlay();
    } catch {
      setError(i18n.translate('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setParts(splitDate(dateOfBirth));
    setError('');
    modalRef.current?.hideOverlay();
  };

  return (
    <>
      <s-section>
        <s-stack direction="block" gap="large-200">
          <s-heading>
            <s-stack direction="inline" gap="small-100">
              <s-text>{i18n.translate('heading')}</s-text>
              <s-link
                aria-label={i18n.translate('edit')}
                command="--show"
                commandFor="date-of-birth-modal"
              >
                <s-icon type="edit" size="small" />
              </s-link>
            </s-stack>
          </s-heading>
          <s-text color={dateOfBirth ? undefined : 'subdued'}>
            {dateOfBirth
              ? formatDate(i18n, dateOfBirth)
              : i18n.translate('notSet')}
          </s-text>
        </s-stack>
      </s-section>

      <s-modal
        id="date-of-birth-modal"
        ref={modalRef}
        heading={i18n.translate('modalHeading')}
      >
        <s-form onSubmit={handleSubmit}>
          <s-stack direction="block" gap="large">
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">{i18n.translate('label')}</s-text>
              <s-grid gridTemplateColumns="1fr 1.6fr 1.2fr" gap="base">
                <s-select
                  label={i18n.translate('day')}
                  labelAccessibilityVisibility="exclusive"
                  placeholder={i18n.translate('day')}
                  autocomplete="bday-day"
                  value={parts.day}
                  onChange={update('day')}
                >
                  {Array.from({length: dayCount}, (_, index) => (
                    <s-option key={index + 1} value={String(index + 1)}>
                      {String(index + 1)}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label={i18n.translate('month')}
                  labelAccessibilityVisibility="exclusive"
                  placeholder={i18n.translate('month')}
                  autocomplete="bday-month"
                  value={parts.month}
                  onChange={update('month')}
                >
                  {Array.from({length: 12}, (_, index) => (
                    <s-option key={index + 1} value={String(index + 1)}>
                      {monthName(i18n, index)}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label={i18n.translate('year')}
                  labelAccessibilityVisibility="exclusive"
                  placeholder={i18n.translate('year')}
                  autocomplete="bday-year"
                  value={parts.year}
                  onChange={update('year')}
                >
                  {years.map((year) => (
                    <s-option key={year} value={String(year)}>
                      {String(year)}
                    </s-option>
                  ))}
                </s-select>
              </s-grid>
              {error ? <s-text tone="critical">{error}</s-text> : null}
            </s-stack>
            <s-stack direction="inline" gap="base" justifyContent="end">
              <s-button
                slot="secondary-actions"
                variant="secondary"
                disabled={loading}
                onClick={handleCancel}
              >
                {i18n.translate('cancel')}
              </s-button>
              <s-button
                slot="primary-action"
                type="submit"
                variant="primary"
                loading={loading}
              >
                {i18n.translate('save')}
              </s-button>
            </s-stack>
          </s-stack>
        </s-form>
      </s-modal>
    </>
  );
}

const pad = (n) => String(n).padStart(2, '0');

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function splitDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match
    ? {year: match[1], month: String(Number(match[2])), day: String(Number(match[3]))}
    : {year: '', month: '', day: ''};
}

// With no year chosen yet, assume a leap year so 29 Feb stays selectable.
function daysInMonth(year, month) {
  if (!month) {
    return 31;
  }
  return new Date(Date.UTC(Number(year) || 2000, Number(month), 0)).getUTCDate();
}

// Returns YYYY-MM-DD for a real date between 1900 and today, otherwise null.
function toIsoDate({year, month, day}, today) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) {
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
  return iso >= `${MIN_YEAR}-01-01` && iso <= today ? iso : null;
}

function monthName(i18n, index) {
  const date = new Date(Date.UTC(2000, index, 1));
  try {
    return i18n.formatDate(date, {month: 'long', timeZone: 'UTC'});
  } catch {
    return String(index + 1);
  }
}

function formatDate(i18n, value) {
  const [year, month, day] = value.split('-').map(Number);
  // Build the date in UTC so the shown day never shifts with the viewer's time zone.
  const date = new Date(Date.UTC(year, month - 1, day));
  try {
    return i18n.formatDate(date, {dateStyle: 'long', timeZone: 'UTC'});
  } catch {
    return value;
  }
}

async function customerAccountQuery(query, variables) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}),
  });
  const {data, errors} = await response.json();
  if (errors?.length) {
    throw new Error(errors[0].message);
  }
  return data;
}

async function getDateOfBirth() {
  const data = await customerAccountQuery(
    `query dateOfBirth($namespace: String!, $key: String!) {
      customer {
        id
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }`,
    {namespace: NAMESPACE, key: KEY}
  );

  return {
    customerId: data.customer.id,
    dateOfBirth: data.customer.metafield?.value,
  };
}

async function saveDateOfBirth(customerId, dateOfBirth) {
  const data = await customerAccountQuery(
    `mutation setDateOfBirth($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      metafields: [
        {
          namespace: NAMESPACE,
          key: KEY,
          type: 'date',
          ownerId: customerId,
          value: dateOfBirth,
        },
      ],
    }
  );

  const {metafields, userErrors} = data.metafieldsSet;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  return metafields[0].value;
}
