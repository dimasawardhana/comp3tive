/** "just now" / "12m ago" / "3h ago" / "2d ago" / a date — History and Squads share it. */
export function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** A caught error as the sentence a toast can show. Eight call sites across
 *  App and the split flow need this exact rule, so it has one home. */
export const formatError = (err: unknown): string => (err instanceof Error ? err.message : String(err));
