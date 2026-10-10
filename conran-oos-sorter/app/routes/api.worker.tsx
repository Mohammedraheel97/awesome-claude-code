import type { ActionFunctionArgs } from "react-router";
import { runTick } from "../sorter/worker.server";

// Optional entry point for an external scheduler (cron, Cloud Scheduler, GitHub Actions…),
// for hosts where the in-process scheduler is turned off (OOS_SORTER_SCHEDULER=off).
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-url>/api/worker
export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }
  const budgetSeconds = Number(new URL(request.url).searchParams.get("budget")) || 50;
  const summary = await runTick({ budgetMs: Math.min(budgetSeconds, 800) * 1000 });
  return Response.json(summary);
};

export const loader = () => new Response("Not found", { status: 404 });
