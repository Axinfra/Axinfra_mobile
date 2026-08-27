/** Matches the web app's formatDate output closely enough for card-level display
 * (src/lib/utils.ts's formatDate on the web repo) — day-month-year, no time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whole-day difference between `iso` and today — positive means days remaining, negative
 * means overdue. Null when there's no date to compute against. Mirrors the web app's
 * daysFromToday (src/lib/activityStatus.ts). */
export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}
