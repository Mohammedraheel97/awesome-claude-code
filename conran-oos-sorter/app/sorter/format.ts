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
