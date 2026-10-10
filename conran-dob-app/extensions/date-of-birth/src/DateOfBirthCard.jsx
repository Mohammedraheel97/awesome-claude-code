// @ts-nocheck
import {render} from 'preact';
import {useState, useRef} from 'preact/hooks';

const API_URL = 'shopify:customer-account/api/2025-10/graphql.json';
const NAMESPACE = '$app';
const KEY = 'date_of_birth';
const MIN_DATE = '1900-01-01';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(props.dateOfBirth ?? '');
  const [newDateOfBirth, setNewDateOfBirth] = useState(dateOfBirth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidDate(newDateOfBirth, today)) {
      setError(i18n.translate('invalid'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const saved = await saveDateOfBirth(props.customerId, newDateOfBirth);
      setDateOfBirth(saved);
      modalRef.current?.hideOverlay();
    } catch {
      setError(i18n.translate('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewDateOfBirth(dateOfBirth);
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
            <s-date-field
              label={i18n.translate('label')}
              value={newDateOfBirth}
              allow={`${MIN_DATE}--${today}`}
              defaultView={(newDateOfBirth || '1990-01').slice(0, 7)}
              autocomplete="bday"
              required
              error={error || undefined}
              onChange={(e) => {
                setNewDateOfBirth(e.currentTarget.value);
                setError('');
              }}
            />
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

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Dates are YYYY-MM-DD strings, so string comparison orders them correctly.
function isValidDate(value, today) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
    value >= MIN_DATE &&
    value <= today
  );
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
