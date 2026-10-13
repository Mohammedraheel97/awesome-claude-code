// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

const FALLBACK_STOREFRONT = 'https://www.theconranshop.com.kw';

export default function extension() {
  render(<BirthdayCard />, document.body);
}

function BirthdayCard() {
  const {i18n} = shopify;
  const storefront = (shopify.shop.storefrontUrl || FALLBACK_STOREFRONT).replace(
    /\/+$/,
    ''
  );
  // The storefront sends the buyer to sign in, then to the profile page of
  // their customer account, where the "Date of birth" card lives.
  const profileUrl = `${storefront}/account/profile`;

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-heading>{i18n.translate('heading')}</s-heading>
        <s-text>{i18n.translate('description')}</s-text>
        <s-stack direction="inline">
          <s-button variant="primary" href={profileUrl} target="_blank">
            {i18n.translate('button')}
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
