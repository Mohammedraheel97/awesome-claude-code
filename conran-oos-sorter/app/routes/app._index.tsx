import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColumnChart, LineChart, Meter, type Point } from "../components/charts";
import { dayLabel, formatDuration, formatWhen, numericId, plural, whenInline } from "../sorter/format";
import { getSettings, isPaused, requestFullSweep, updateSettings, utcDay } from "../sorter/store.server";
import { kickTick } from "../sorter/worker.server";

const CHART_DAYS = 14;
const DAY_MS = 86_400_000;
/** The worker counts as running if it ran this recently (a busy run can take a few minutes). */
const HEALTHY_MS = 10 * 60_000;

type Mode = "off" | "preview" | "live";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);
  const now = new Date();
  const days = Array.from({ length: CHART_DAYS }, (_, i) => utcDay(new Date(now.getTime() - (CHART_DAYS - 1 - i) * DAY_MS)));

  const [collections, excluded, queued, failing, products, outOfStock, pendingChecks, restoring, preview, daily, activity, errors, mostOutOfStock] =
    await Promise.all([
      db.collectionState.count({ where: { shop } }),
      db.collectionState.count({ where: { shop, excluded: true } }),
      db.collectionState.count({ where: { shop, dirty: true, excluded: false } }),
      db.collectionState.count({ where: { shop, excluded: false, lastError: { not: null } } }),
      db.productStock.count({ where: { shop } }),
      db.productStock.count({ where: { shop, available: false } }),
      db.pendingCheck.count({ where: { shop } }),
      db.collectionState.count({ where: { shop, restoreRequested: true } }),
      db.collectionState.aggregate({
        where: { shop, excluded: false, lastRunLive: false, lastMoves: { gt: 0 } },
        _count: true,
        _sum: { lastMoves: true },
      }),
      db.dailyStats.findMany({ where: { shop, day: { gte: days[0] } } }),
      db.activityLog.findMany({ where: { shop }, orderBy: { id: "desc" }, take: 25 }),
      db.collectionState.findMany({
        where: { shop, excluded: false, lastError: { not: null } },
        orderBy: { title: "asc" },
        take: 5,
      }),
      db.collectionState.findMany({
        where: { shop, excluded: false, outOfStockCount: { gt: 0 } },
        orderBy: { outOfStockCount: "desc" },
        take: 5,
      }),
    ]);

  const byDay = new Map(daily.map((row) => [row.day, row]));
  const moved: Point[] = days.map((day) => ({ key: day, label: dayLabel(day), value: byDay.get(day)?.productsMoved ?? 0 }));
  const outOfStockTrend: Point[] = days.map((day) => ({ key: day, label: dayLabel(day), value: byDay.get(day)?.outOfStock ?? null }));

  const mode: Mode = !settings.enabled ? "off" : settings.liveMode ? "live" : "preview";
  const pausedFor = isPaused(settings, now.getTime()) ? settings.pausedUntil!.getTime() - now.getTime() : 0;
  const tickAge = settings.lastTickAt ? now.getTime() - settings.lastTickAt.getTime() : null;
  const managed = collections - excluded;
  const nextFullCheck = settings.lastFullSweepAt
    ? settings.lastFullSweepAt.getTime() + settings.fullSweepIntervalHours * 3_600_000 - now.getTime()
    : 0;

  return {
    now: now.toISOString(),
    mode,
    restoreAll: settings.restoreAllStatus,
    restoring,
    pausedFor,
    worker: {
      lastRunAt: settings.lastTickAt?.toISOString() ?? null,
      healthy: tickAge !== null && tickAge <= HEALTHY_MS,
      schedulerOff: process.env.OOS_SORTER_SCHEDULER === "off",
    },
    fullCheck: {
      lastAt: settings.lastFullSweepAt?.toISOString() ?? null,
      nextIn: Math.max(0, nextFullCheck),
      intervalHours: settings.fullSweepIntervalHours,
      done: Math.max(0, managed - queued),
      total: managed,
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
      movedToday: byDay.get(days[days.length - 1])?.productsMoved ?? 0,
      movedThisWeek: days.slice(-7).reduce((sum, day) => sum + (byDay.get(day)?.productsMoved ?? 0), 0),
    },
    charts: { moved, outOfStock: outOfStockTrend },
    attention: {
      errors: errors.map((c) => ({ id: numericId(c.collectionId), title: c.title, error: c.lastError ?? "" })),
      mostOutOfStock: mostOutOfStock.map((c) => ({
        id: numericId(c.collectionId),
        title: c.title,
        outOfStock: c.outOfStockCount ?? 0,
        products: c.productCount ?? 0,
      })),
    },
    activity: activity.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      collectionId: entry.collectionId ? numericId(entry.collectionId) : null,
      message: entry.message,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const settings = await getSettings(shop);

  switch (form.get("intent")) {
    case "mode": {
      const mode = form.get("mode");
      if (mode === "off") {
        await updateSettings(shop, { enabled: false });
        return { message: "The app is off. Collections keep their current order." };
      }
      if (mode === "preview" || mode === "live") {
        const live = mode === "live";
        // Turning on, or going live, starts with a full check so everything is up to date.
        const recheck = !settings.enabled || (live && !settings.liveMode);
        await updateSettings(shop, { enabled: true, liveMode: live, ...(recheck ? { lastFullSweepAt: null } : {}) });
        kickTick();
        return {
          message: live
            ? "Live. Collections are being sorted now."
            : "Preview mode. Plans are worked out, but nothing is changed.",
        };
      }
      return { message: "Unknown mode." };
    }
    case "pause": {
      const hours = Math.min(72, Math.max(1, Number(form.get("hours")) || 1));
      await updateSettings(shop, { pausedUntil: new Date(Date.now() + hours * 3_600_000) });
      return { message: `Paused for ${plural(hours, "hour")}. Stock changes are still recorded.` };
    }
    case "resume":
      await updateSettings(shop, { pausedUntil: null });
      kickTick();
      return { message: "Resumed. Catching up on changes now." };
    case "run-now":
      await requestFullSweep(shop);
      kickTick();
      return { message: "Full check started." };
    case "process-now":
      kickTick();
      return { message: "Processing waiting work now." };
    case "restore-all":
      await updateSettings(shop, { restoreAllStatus: "requested", liveMode: false });
      kickTick();
      return { message: "Restoring every collection. The app turns off when it's done." };
    default:
      return { message: "Unknown action." };
  }
};

type Data = ReturnType<typeof useLoaderData<typeof loader>>;

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const { now, mode, stats, fullCheck, charts, attention, activity } = data;
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const busy = fetcher.state !== "idle";
  const working = data.restoreAll !== null || stats.queued > 0 || stats.pendingChecks > 0;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.message) shopify.toast.show(fetcher.data.message);
  }, [fetcher.state, fetcher.data, shopify]);

  // Keep the numbers live while there is work in progress.
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => revalidator.revalidate(), 15_000);
    return () => clearInterval(timer);
  }, [working, revalidator]);

  const submit = (fields: Record<string, string>) => fetcher.submit(fields, { method: "POST" });
  const loading = busy ? { loading: true } : {};

  return (
    <s-page heading="Out-of-stock sorter">
      <s-button slot="primary-action" variant="primary" onClick={() => submit({ intent: "run-now" })} {...loading}>
        Run full check now
      </s-button>
      <s-button slot="secondary-actions" onClick={() => submit({ intent: "process-now" })}>
        Process waiting work
      </s-button>

      <StatusBanner data={data} />

      <s-section heading="Controls">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>Mode</s-heading>
                <ModeBadge mode={mode} />
              </s-stack>
              <s-text color="subdued">{MODE_HELP[mode]}</s-text>
              <s-stack direction="inline" gap="small-200">
                {mode !== "live" && (
                  <s-button variant="primary" commandFor="go-live-modal" command="--show" {...(data.restoreAll ? { disabled: true } : {})}>
                    Go live
                  </s-button>
                )}
                {mode !== "preview" && (
                  <s-button onClick={() => submit({ intent: "mode", mode: "preview" })} {...(data.restoreAll ? { disabled: true } : {})}>
                    {mode === "off" ? "Turn on in preview" : "Switch to preview"}
                  </s-button>
                )}
                {mode !== "off" && (
                  <s-button onClick={() => submit({ intent: "mode", mode: "off" })}>Turn off</s-button>
                )}
              </s-stack>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-heading>Pause</s-heading>
              {data.pausedFor > 0 ? (
                <>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone="warning">Paused</s-badge>
                    <s-text>{formatDuration(data.pausedFor)} left</s-text>
                  </s-stack>
                  <s-button onClick={() => submit({ intent: "resume" })}>Resume now</s-button>
                </>
              ) : (
                <>
                  <s-stack direction="inline" gap="small-200">
                    {[1, 4, 24].map((hours) => (
                      <s-button key={hours} onClick={() => submit({ intent: "pause", hours: String(hours) })} {...(mode === "off" ? { disabled: true } : {})}>
                        {hours === 24 ? "1 day" : plural(hours, "hour")}
                      </s-button>
                    ))}
                  </s-stack>
                  <s-text color="subdued">Freeze collection order, e.g. while merchandising a campaign. Stock changes are still recorded.</s-text>
                </>
              )}
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Overview">
        <s-stack gap="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
            <Stat
              label="Products out of stock"
              value={stats.outOfStock.toLocaleString("en-GB")}
              hint={stats.products ? `${Math.round((stats.outOfStock / stats.products) * 100)}% of ${stats.products.toLocaleString("en-GB")} products` : "Counted on the first full check"}
            />
            <Stat
              label="Collections managed"
              value={(stats.collections - stats.excluded).toLocaleString("en-GB")}
              hint={stats.excluded ? `${stats.excluded} excluded` : "None excluded"}
            />
            {mode === "live" ? (
              <Stat label="Products moved today" value={stats.movedToday.toLocaleString("en-GB")} hint={`${stats.movedThisWeek.toLocaleString("en-GB")} in the last 7 days`} />
            ) : (
              <Stat
                label="Moves waiting for go-live"
                value={stats.previewMoves.toLocaleString("en-GB")}
                hint={`In ${plural(stats.previewCollections, "collection")}`}
              />
            )}
            <WorkerStat data={data} />
          </s-grid>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-stack direction="inline" justifyContent="space-between" gap="base">
                <s-heading>Full check</s-heading>
                <s-text color="subdued">
                  {fullCheck.lastAt
                    ? `Last ${whenInline(fullCheck.lastAt, now)} · next ${fullCheck.nextIn > 0 ? `in ${formatDuration(fullCheck.nextIn)}` : "now"}`
                    : "Starts within a minute"}
                </s-text>
              </s-stack>
              <Meter value={fullCheck.done} max={fullCheck.total} label="Collections checked" />
              <s-text color="subdued">
                {fullCheck.total === 0
                  ? "No collections yet."
                  : stats.queued > 0
                    ? `${fullCheck.done.toLocaleString("en-GB")} of ${plural(fullCheck.total, "collection")} up to date · ${stats.queued.toLocaleString("en-GB")} waiting`
                    : `All ${plural(fullCheck.total, "collection")} up to date`}
                {stats.pendingChecks > 0 ? ` · ${plural(stats.pendingChecks, "stock change")} to check` : ""}
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Products moved per day">
        <ColumnChart
          points={charts.moved}
          valueHeading="Products moved"
          describe={(value) => `${plural(value, "product")} moved`}
          emptyMessage={mode === "live" ? "Nothing has needed moving in the last 14 days." : "Nothing is moved until the app goes live."}
        />
      </s-section>

      <s-section heading="Products out of stock">
        <LineChart
          points={charts.outOfStock}
          valueHeading="Out of stock"
          describe={(value) => `${plural(value, "product")} out of stock`}
          emptyMessage="The first data point appears after the first full check."
        />
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
                      <s-link href={`/app/collections/${entry.collectionId}`}>{entry.title}</s-link>
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

      <s-section slot="aside" heading="Needs attention">
        <s-stack gap="base">
          {attention.errors.length > 0 && (
            <s-stack gap="small-200">
              <s-text type="strong">{plural(stats.failing, "collection")} failed</s-text>
              {attention.errors.map((c) => (
                <s-stack key={c.id} gap="none">
                  <s-link href={`/app/collections/${c.id}`}>{c.title}</s-link>
                  <s-text color="subdued">{c.error.slice(0, 120)}</s-text>
                </s-stack>
              ))}
              {stats.failing > attention.errors.length && <s-link href="/app/collections?filter=errors">See all</s-link>}
            </s-stack>
          )}
          <s-stack gap="small-200">
            <s-text type="strong">Most out-of-stock products</s-text>
            {attention.mostOutOfStock.length === 0 ? (
              <s-text color="subdued">Shown after the first full check.</s-text>
            ) : (
              attention.mostOutOfStock.map((c) => (
                <s-stack key={c.id} direction="inline" justifyContent="space-between" gap="small-200">
                  <s-link href={`/app/collections/${c.id}`}>{c.title}</s-link>
                  <s-text color="subdued">
                    {c.outOfStock.toLocaleString("en-GB")} of {c.products.toLocaleString("en-GB")}
                  </s-text>
                </s-stack>
              ))
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Undo">
        <s-stack gap="small-200">
          <s-paragraph>
            Put every collection back the way it was before the app: pushed-down products return to their merchandised
            positions and automatic sort orders are switched back on. Then the app turns off.
          </s-paragraph>
          <s-button tone="critical" commandFor="restore-all-modal" command="--show" {...(data.restoreAll ? { disabled: true } : {})}>
            Restore all and turn off
          </s-button>
          <s-text color="subdued">To undo a single collection, open it from the Collections page.</s-text>
        </s-stack>
      </s-section>

      <s-modal id="go-live-modal" heading="Go live?">
        <s-stack gap="base">
          <s-paragraph>
            The app will start moving out-of-stock products to the bottom of every collection that isn&apos;t excluded.
            {stats.previewMoves > 0 ? ` The current plan moves ${plural(stats.previewMoves, "product")} in ${plural(stats.previewCollections, "collection")}.` : ""}
          </s-paragraph>
          <s-paragraph>
            Turn off ST Product Collection Sort first, or the two apps will keep undoing each other.
          </s-paragraph>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          commandFor="go-live-modal"
          command="--hide"
          onClick={() => submit({ intent: "mode", mode: "live" })}
        >
          Go live
        </s-button>
        <s-button slot="secondary-actions" commandFor="go-live-modal" command="--hide">
          Cancel
        </s-button>
      </s-modal>

      <s-modal id="restore-all-modal" heading="Restore every collection?">
        <s-paragraph>
          Every collection goes back to its merchandised order with out-of-stock products mixed in again, and collections
          that used an automatic sort get it back. The app then turns off. This can take a few minutes.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="restore-all-modal"
          command="--hide"
          onClick={() => submit({ intent: "restore-all" })}
        >
          Restore all and turn off
        </s-button>
        <s-button slot="secondary-actions" commandFor="restore-all-modal" command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === "live") return <s-badge tone="success">Live</s-badge>;
  if (mode === "preview") return <s-badge tone="warning">Preview</s-badge>;
  return <s-badge tone="critical">Off</s-badge>;
}

const MODE_HELP: Record<Mode, string> = {
  off: "Nothing is read or changed. Collections keep their current order.",
  preview: "Plans are worked out and shown, but no collection is changed.",
  live: "Out-of-stock products are moved to the bottom as stock changes.",
};

function StatusBanner({ data }: { data: Data }) {
  if (data.restoreAll) {
    return (
      <s-banner tone="info" heading="Restoring every collection">
        <s-paragraph>
          {data.restoring > 0 ? `${plural(data.restoring, "collection")} left. ` : ""}The app turns off when it&apos;s done.
        </s-paragraph>
      </s-banner>
    );
  }
  if (data.mode === "off") {
    return (
      <s-banner tone="critical" heading="The app is off">
        <s-paragraph>Collections keep their current order. Switch to Preview or Live under Controls.</s-paragraph>
      </s-banner>
    );
  }
  if (data.pausedFor > 0) {
    return (
      <s-banner tone="warning" heading={`Paused for ${formatDuration(data.pausedFor)}`}>
        <s-paragraph>No collection is changed until then. Stock changes are recorded and applied on resume.</s-paragraph>
      </s-banner>
    );
  }
  if (data.mode === "preview") {
    return (
      <s-banner tone="warning" heading="Preview mode: no collections are being changed">
        <s-paragraph>
          Review the planned moves on the Collections page, try one with &quot;Apply to this collection only&quot;, then go live.
        </s-paragraph>
      </s-banner>
    );
  }
  return null;
}

function WorkerStat({ data }: { data: Data }) {
  const { worker, now, mode } = data;
  if (mode === "off" && !data.restoreAll) {
    return <Stat label="Background worker" value="Idle" hint="The app is off" />;
  }
  if (!worker.lastRunAt) {
    return (
      <Stat
        label="Background worker"
        value="Starting"
        hint={worker.schedulerOff ? "Scheduler is off: call POST /api/worker" : "First run within a minute"}
      />
    );
  }
  return (
    <Stat
      label="Background worker"
      value={worker.healthy ? "Running" : "Not running"}
      hint={`Last ran ${whenInline(worker.lastRunAt, now)}`}
      badge={worker.healthy ? <s-badge tone="success">OK</s-badge> : <s-badge tone="critical">Check hosting</s-badge>}
    />
  );
}

function Stat({ label, value, hint, badge }: { label: string; value: string; hint?: string; badge?: JSX.Element }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" gap="small-200">
          <s-text color="subdued">{label}</s-text>
          {badge}
        </s-stack>
        <s-heading>{value}</s-heading>
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
    case "restored":
      return <s-badge tone="info">Restored</s-badge>;
    case "error":
      return <s-badge tone="critical">Error</s-badge>;
    default:
      return <s-badge>Info</s-badge>;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
