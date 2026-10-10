import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatWhen, numericId, plural } from "../sorter/format";
import { getSettings, requestFullSweep, updateSettings } from "../sorter/store.server";
import { kickTick } from "../sorter/worker.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);

  const [collections, excluded, queued, failing, products, outOfStock, pendingChecks, preview, activity] =
    await Promise.all([
      db.collectionState.count({ where: { shop } }),
      db.collectionState.count({ where: { shop, excluded: true } }),
      db.collectionState.count({ where: { shop, dirty: true, excluded: false } }),
      db.collectionState.count({ where: { shop, excluded: false, lastError: { not: null } } }),
      db.productStock.count({ where: { shop } }),
      db.productStock.count({ where: { shop, available: false } }),
      db.pendingCheck.count({ where: { shop } }),
      db.collectionState.aggregate({
        where: { shop, excluded: false, lastRunLive: false, lastMoves: { gt: 0 } },
        _count: true,
        _sum: { lastMoves: true },
      }),
      db.activityLog.findMany({ where: { shop }, orderBy: { id: "desc" }, take: 30 }),
    ]);

  return {
    now: new Date().toISOString(),
    settings: {
      enabled: settings.enabled,
      liveMode: settings.liveMode,
      pinTag: settings.pinTag,
      restoreManualPositions: settings.restoreManualPositions,
      fullSweepIntervalHours: settings.fullSweepIntervalHours,
      lastFullSweepAt: settings.lastFullSweepAt?.toISOString() ?? null,
    },
    stats: {
      collections,
      excluded,
      queued,
      failing,
      products,
      outOfStock,
      pendingChecks,
      previewCollections: preview._count,
      previewMoves: preview._sum.lastMoves ?? 0,
    },
    activity: activity.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      collectionId: entry.collectionId,
      message: entry.message,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();

  switch (form.get("intent")) {
    case "go-live":
      await updateSettings(shop, { liveMode: true, enabled: true, lastFullSweepAt: null });
      kickTick();
      return { message: "Live mode on. Collections are being sorted now." };
    case "go-preview":
      await updateSettings(shop, { liveMode: false });
      return { message: "Preview mode on. The app will no longer change collections." };
    case "run-now":
      await requestFullSweep(shop);
      kickTick();
      return { message: "Full check started." };
    case "save-settings": {
      const current = await getSettings(shop);
      const pinTag = String(form.get("pinTag") ?? "").trim();
      const hours = Math.round(Number(form.get("fullSweepIntervalHours")));
      const next = {
        enabled: form.get("enabled") === "on",
        restoreManualPositions: form.get("restoreManualPositions") === "on",
        pinTag,
        fullSweepIntervalHours: Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 168) : current.fullSweepIntervalHours,
      };
      // A different pin tag changes which products stay put, so everything is re-checked.
      const recheck = next.pinTag.toLowerCase() !== current.pinTag.toLowerCase() || (next.enabled && !current.enabled);
      await updateSettings(shop, { ...next, ...(recheck ? { lastFullSweepAt: null } : {}) });
      if (recheck) kickTick();
      return { message: "Settings saved." };
    }
    default:
      return { message: "Unknown action." };
  }
};

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;

export default function Dashboard() {
  const { now, settings, stats, activity } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  const submit = (intent: string) => fetcher.submit({ intent }, { method: "POST" });

  return (
    <s-page heading="Out-of-stock sorter">
      <s-button slot="primary-action" onClick={() => submit("run-now")} {...(busy ? { loading: true } : {})}>
        Run full check now
      </s-button>

      <ModeBanner settings={settings} stats={stats} onSubmit={submit} busy={busy} />

      <s-section heading="Overview">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Stat label="Collections" value={stats.collections} hint={stats.excluded ? `${stats.excluded} excluded` : "All included"} />
          <Stat label="Products out of stock" value={stats.outOfStock} hint={`of ${stats.products.toLocaleString("en-GB")} products`} />
          <Stat label="Waiting to be sorted" value={stats.queued} hint={stats.pendingChecks ? `${plural(stats.pendingChecks, "stock change")} to check` : "No stock changes waiting"} />
          <Stat label="Last full check" value={formatWhen(settings.lastFullSweepAt, now)} hint={`Every ${plural(settings.fullSweepIntervalHours, "hour")}`} />
        </s-grid>
        {stats.failing > 0 && (
          <s-box paddingBlockStart="base">
            <s-banner tone="critical" heading={`${plural(stats.failing, "collection")} failed on the last run`}>
              <s-paragraph>
                See the <s-link href="/app/collections?filter=errors">Collections</s-link> page for details. They are retried on the next full check.
              </s-paragraph>
            </s-banner>
          </s-box>
        )}
      </s-section>

      <s-section heading="Recent activity">
        {activity.length === 0 ? (
          <s-paragraph color="subdued">Nothing yet. The first full check starts within a minute of installing.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Collection</s-table-header>
              <s-table-header listSlot="labeled">What happened</s-table-header>
              <s-table-header listSlot="secondary">When</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {activity.map((entry) => (
                <s-table-row key={entry.id}>
                  <s-table-cell>
                    {entry.collectionId ? (
                      <s-link href={`/app/collections/${numericId(entry.collectionId)}`}>{entry.title}</s-link>
                    ) : (
                      <s-text color="subdued">All collections</s-text>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <KindBadge kind={entry.kind} />
                      <s-text>{entry.message}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{formatWhen(entry.createdAt, now)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Settings">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="save-settings" />
          <s-stack gap="base">
            <s-checkbox
              name="enabled"
              value="on"
              label="App enabled"
              details="When off, the app doesn't read or change anything."
              defaultChecked={settings.enabled}
            />
            <s-checkbox
              name="restoreManualPositions"
              value="on"
              label="Return restocked products to their old position"
              details="Manual collections only. Otherwise they go to the end of the in-stock products."
              defaultChecked={settings.restoreManualPositions}
            />
            <s-text-field
              name="pinTag"
              label="Keep-in-place tag"
              details="Products with this tag are never pushed down (e.g. pre-orders or hero pieces)."
              defaultValue={settings.pinTag}
            />
            <s-number-field
              name="fullSweepIntervalHours"
              label="Full check every (hours)"
              details="Stock changes are handled within a minute. The full check also refreshes best-selling orders."
              min={1}
              max={168}
              defaultValue={String(settings.fullSweepIntervalHours)}
            />
            <s-button type="submit" {...(busy ? { loading: true } : {})}>
              Save settings
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>A product counts as out of stock when none of its variants can be sold.</s-list-item>
          <s-list-item>In every collection, out-of-stock products move below in-stock ones. Both groups keep their order.</s-list-item>
          <s-list-item>
            Manual collections keep your merchandising. Collections set to best selling, newest or another automatic sort keep that order, but the app switches them to manual so it can move products.
          </s-list-item>
          <s-list-item>To change a collection&apos;s order, pick a new sort in Shopify admin. The app uses it as the base order.</s-list-item>
          <s-list-item>Turn off any other app that reorders collections, such as ST Product Collection Sort. Otherwise the two will keep undoing each other.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

function ModeBanner({
  settings,
  stats,
  onSubmit,
  busy,
}: {
  settings: LoaderData["settings"];
  stats: LoaderData["stats"];
  onSubmit: (intent: string) => void;
  busy: boolean;
}) {
  if (!settings.enabled) {
    return (
      <s-banner tone="critical" heading="The app is turned off">
        <s-paragraph>Turn it back on under Settings to keep collections sorted.</s-paragraph>
      </s-banner>
    );
  }
  if (!settings.liveMode) {
    return (
      <s-banner tone="warning" heading="Preview mode: no collections are being changed">
        <s-paragraph>
          {stats.previewCollections > 0
            ? `${plural(stats.previewCollections, "collection")} would change (${plural(stats.previewMoves, "product move")}). `
            : "No changes planned yet. "}
          Open a collection on the Collections page to see exactly what would move. When it looks right, go live.
        </s-paragraph>
        <s-button slot="secondary-actions" variant="primary" onClick={() => onSubmit("go-live")} {...(busy ? { disabled: true } : {})}>
          Go live
        </s-button>
      </s-banner>
    );
  }
  return (
    <s-banner tone="success" heading="Live: out-of-stock products are being pushed to the bottom">
      <s-paragraph>Stock changes are picked up within a minute, and every collection is re-checked on a schedule.</s-paragraph>
      <s-button slot="secondary-actions" onClick={() => onSubmit("go-preview")} {...(busy ? { disabled: true } : {})}>
        Switch back to preview
      </s-button>
    </s-banner>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{typeof value === "number" ? value.toLocaleString("en-GB") : value}</s-heading>
        {hint && <s-text color="subdued">{hint}</s-text>}
      </s-stack>
    </s-box>
  );
}

function KindBadge({ kind }: { kind: string }) {
  switch (kind) {
    case "sorted":
      return <s-badge tone="success">Sorted</s-badge>;
    case "preview":
      return <s-badge tone="warning">Preview</s-badge>;
    case "sweep":
      return <s-badge tone="info">Full check</s-badge>;
    case "error":
      return <s-badge tone="critical">Error</s-badge>;
    default:
      return <s-badge>Info</s-badge>;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
