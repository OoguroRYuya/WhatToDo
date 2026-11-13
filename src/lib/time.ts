/** Timestamps are stored as ISO-8601 UTC strings, so they sort and compare as text. */
export const nowIso = () => new Date().toISOString();

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** "Today", "Tomorrow", "Yesterday", otherwise "14 Nov". */
export function dueLabel(due: string | null): string | null {
  if (!due) return null;
  if (due === localDate()) return 'Today';
  if (due === addDays(1)) return 'Tomorrow';
  if (due === addDays(-1)) return 'Yesterday';
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function isOverdue(due: string | null, completed: boolean): boolean {
  return !!due && !completed && due < localDate();
}

/** "14:02" today, otherwise "13 Nov, 14:02". */
export function stampTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return localDate(d) === localDate() ? time : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}
