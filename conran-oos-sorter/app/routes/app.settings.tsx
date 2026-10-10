import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, updateSettings } from "../sorter/store.server";
import { kickTick } from "../sorter/worker.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return {
    pinTag: settings.pinTag,
    restoreManualPositions: settings.restoreManualPositions,
    fullSweepIntervalHours: settings.fullSweepIntervalHours,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const current = await getSettings(shop);

  const pinTag = String(form.get("pinTag") ?? "").trim();
  const hours = Math.round(Number(form.get("fullSweepIntervalHours")));
  const next = {
    pinTag,
    restoreManualPositions: form.get("restoreManualPositions") === "on",
    fullSweepIntervalHours: Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 168) : current.fullSweepIntervalHours,
  };
  // A different keep-in-place tag changes which products stay put, so everything is re-checked.
  const recheck = next.pinTag.toLowerCase() !== current.pinTag.toLowerCase();
  await updateSettings(shop, { ...next, ...(recheck ? { lastFullSweepAt: null } : {}) });
  if (recheck) kickTick();
  return { message: recheck ? "Settings saved. Re-checking every collection." : "Settings saved." };
};

export default function Settings() {
  const settings = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <s-page heading="Settings">
      <s-section heading="Sorting">
        <fetcher.Form method="post">
          <s-stack gap="base">
            <s-text-field
              name="pinTag"
              label="Keep-in-place tag"
              details="Products with this tag are never pushed down, even when out of stock (e.g. pre-orders or hero pieces)."
              defaultValue={settings.pinTag}
            />
            <s-checkbox
              name="restoreManualPositions"
              value="on"
              label="Return restocked products to their old position"
              details="Manual collections only. When off, restocked products join the end of the in-stock products."
              defaultChecked={settings.restoreManualPositions}
            />
            <s-number-field
              name="fullSweepIntervalHours"
              label="Full check every (hours)"
              details="Stock changes are handled within a minute anyway. The full check also refreshes best-selling and other automatic orders."
              min={1}
              max={168}
              defaultValue={String(settings.fullSweepIntervalHours)}
            />
            <s-button type="submit" variant="primary" {...(fetcher.state !== "idle" ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>
      <s-section slot="aside" heading="Mode, pause and undo">
        <s-paragraph>
          Turning the app off, preview, going live, pausing and undoing are on the <s-link href="/app">Dashboard</s-link>.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
