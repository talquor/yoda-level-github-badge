// lib/streak.ts
/**
 * Compute a "level-up streak" in DAYS:
 * Number of consecutive days (going backward from the most recent day with data)
 * where the rolling-7-day sum STRICTLY increased vs the previous day.
 *
 * This rewards consistent, incremental progress and smooths out noisy daily counts.
 */

export type DayCount = { date: string; count: number }; // ISO date (YYYY-MM-DD), non-negative count

/** Normalize an ISO date string to YYYY-MM-DD (UTC) */
export function toYMD(d: string | Date): string {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Fill missing days with 0 between minDate..maxDate (inclusive), sorted ascending */
export function normalizeDays(raw: DayCount[], minDate: string, maxDate: string): DayCount[] {
  const map = new Map<string, number>();
  for (const d of raw) {
    map.set(toYMD(d.date), Math.max(0, d.count || 0));
  }
  const out: DayCount[] = [];
  let cur = new Date(minDate + 'T00:00:00Z').getTime();
  const end = new Date(maxDate + 'T00:00:00Z').getTime();
  const dayMs = 86400000;
  while (cur <= end) {
    const ymd = toYMD(cur);
    out.push({ date: ymd, count: map.get(ymd) ?? 0 });
    cur += dayMs;
  }
  return out;
}

/** Rolling window sums; same length as input; first (window-1) entries are partial */
function rollingSum(arr: number[], window = 7): number[] {
  const out: number[] = new Array(arr.length).fill(0);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= window) sum -= arr[i - window];
    out[i] = sum;
  }
  return out;
}

/**
 * Compute streak days:
 * - Build rolling 7-day sums
 * - Find last index with data (usually last day)
 * - Count how many consecutive steps going backward keep strictly increasing vs previous day
 */
export function computeStreakDays(days: DayCount[]): number {
  if (!days.length) return 0;
  const counts = days.map(d => Math.max(0, d.count || 0));
  const roll = rollingSum(counts, 7);
  // Start from the last day that has any data in the window (non-NaN always with our rolling)
  let i = roll.length - 1;
  // Streak counts how many consecutive deltas are > 0 when stepping backward
  let streak = 0;
  while (i > 0) {
    const today = roll[i];
    const prev = roll[i - 1];
    if (today > prev) streak += 1;
    else break;
    i -= 1;
  }
  return streak;
}

/**
 * Helper to convert GitHub contribution calendar (GraphQL) to DayCount[]
 */
export function fromContributionCalendar(weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>): DayCount[] {
  const out: DayCount[] = [];
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      out.push({ date: toYMD(d.date), count: d.contributionCount || 0 });
    }
  }
  // They are already chronological by week/day; we’ll sort just in case.
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Helper to convert REST Events to DayCount[] (coarse approximation).
 * We count events per day for the last N days; it’s a weaker signal than GraphQL calendar
 * but lets us compute a streak without a token.
 */
export function fromEvents(events: Array<{ created_at: string }>, daysBack = 90): DayCount[] {
  const dayMs = 86400000;
  const today = new Date();
  const startMs = today.getTime() - daysBack * dayMs;
  const buckets = new Map<string, number>();
  for (const e of events || []) {
    const t = new Date(e.created_at).getTime();
    if (isNaN(t) || t < startMs) continue;
    const ymd = toYMD(e.created_at);
    buckets.set(ymd, (buckets.get(ymd) || 0) + 1);
  }
  const minYMD = toYMD(startMs);
  const maxYMD = toYMD(today);
  const list: DayCount[] = [];
  let cur = startMs;
  while (cur <= today.getTime()) {
    const ymd = toYMD(cur);
    list.push({ date: ymd, count: buckets.get(ymd) || 0 });
    cur += dayMs;
  }
  // Normalize already generates full range; return as-is
  return list;
}
