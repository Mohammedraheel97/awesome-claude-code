import { formatWhen } from "../sorter/format";

export interface CollectionRow {
  excluded: boolean;
  dirty: boolean;
  lastError: string | null;
  lastSortedAt: string | null;
  lastMoves: number | null;
  lastRunLive: boolean | null;
}

export function CollectionStatus({ collection, now }: { collection: CollectionRow; now: string }) {
  if (collection.excluded) return <s-badge>Excluded</s-badge>;
  if (collection.lastError) {
    return (
      <s-stack gap="small-100">
        <s-badge tone="critical">Error</s-badge>
        <s-text color="subdued">{collection.lastError.slice(0, 160)}</s-text>
      </s-stack>
    );
  }
  if (collection.dirty) return <s-badge tone="info">Waiting</s-badge>;
  if (!collection.lastSortedAt) return <s-badge>Not checked yet</s-badge>;
  const when = formatWhen(collection.lastSortedAt, now);
  if (collection.lastRunLive === false && (collection.lastMoves ?? 0) > 0) {
    return <s-badge tone="warning">{`Would move ${collection.lastMoves} · ${when}`}</s-badge>;
  }
  if (collection.lastRunLive && (collection.lastMoves ?? 0) > 0) {
    return <s-badge tone="success">{`Moved ${collection.lastMoves} · ${when}`}</s-badge>;
  }
  return <s-badge tone="success">{`In order · ${when}`}</s-badge>;
}
