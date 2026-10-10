/** "just now", "5 min ago", "3 h ago", then a date. `now` comes from the server so SSR and hydration agree. */
export function formatWhen(iso: string | null | undefined, nowIso: string): string {
  if (!iso) return "Never";
  const seconds = Math.round((Date.parse(nowIso) - Date.parse(iso)) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const plural = (count: number, word: string) => `${count.toLocaleString("en-GB")} ${word}${count === 1 ? "" : "s"}`;

/** gid://shopify/Collection/123 -> 123 */
export const numericId = (gid: string) => gid.split("/").pop() ?? gid;

/** formatWhen for use mid-sentence: "last ran just now", "last ran 5 min ago". */
export function whenInline(iso: string | null | undefined, nowIso: string): string {
  const text = formatWhen(iso, nowIso);
  return text === "Just now" || text === "Never" ? text.toLowerCase() : text;
}

/** "2026-10-10" -> "10 Oct" */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "45 min", "3 h 20 min", "2 days" */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} h ${restMinutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : plural(days, "day");
}
