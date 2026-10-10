# Conran Date of Birth

Adds a **Date of birth** card to the customer account profile page of The Conran Shop
(Shopify's new customer accounts). Customers add or edit their date of birth there; it is
saved on the customer as the metafield `app--<app id>.date_of_birth` (type `date`), and staff
can see and edit it under **Date of birth** on the customer page in Shopify admin.

Text is in English and Arabic (`extensions/date-of-birth/locales`).

## One-time setup

1. Create a free Shopify Partner account at https://partners.shopify.com, or use the
   store's existing one.
2. Install Node.js 20+.
3. In this folder:

   ```sh
   npm install
   npx shopify app config link   # choose "Create a new app", name it "Conran Date of Birth"
   npx shopify app deploy        # publishes the extension
   ```

4. In the Partner Dashboard, open the app → **Distribution** → **Custom distribution**,
   enter the store domain, and install the app on The Conran Shop using the link it gives you.
5. In Shopify admin go to **Settings → Customer accounts → Customize** (the customer account
   editor). Open the **Profile** page, click **Add app block**, choose **Date of birth**, and save.

## Try before going live

`npx shopify app dev` previews the card on a development store before step 4.

## Files

- `shopify.app.toml` – app config, access scopes and the `date_of_birth` metafield definition
- `extensions/date-of-birth/src/DateOfBirthCard.jsx` – the profile card and edit popup
- `extensions/date-of-birth/locales/` – English and Arabic text
