// lib/streak.ts
/**
 * Streak utilities
 * - classic: consecutive days (from anchor backward) with ≥1 contribution.
 * - momentum: consecutive days where the rolling-7-day sum strictly increases vs the previous day.
 */

export type DayCount = { date: string; count: number }; // YYYY-MM-DD, non-negative

/** Normalize an input to Date and format as YYYY-MM-DD (UTC) */
export function toYMD(d: string | number | Date): string {
  const dt = typeof d === 'number' ? new Date(d) : new Date(d);
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

/** 🚀 Classic streak with anchor ('today' or 'lastActive') */
export function computeClassicStreak(
  days: DayCount[],
  anchor: 'today' | 'lastActive' = 'lastActive'
): number {
  if (!days.length) return 0;
  let i = days.length - 1;

  if (anchor === 'today') {
    if (days[i].count < 1) return 0;
  } else {
    // lastActive → walk back to the latest day with activity
    while (i >= 0 && days[i].count < 1) i--;
    if (i < 0) return 0;
  }

  let streak = 0;
  while (i >= 0 && days[i].count >= 1) {
    streak += 1;
    i -= 1;
  }
  return streak;
}

/** ⚡ Momentum streak: consecutive days where 7-day sum strictly increases day-over-day. */
export function computeMomentumStreak(days: DayCount[]): number {
  if (!days.length) return 0;
  const counts = days.map(d => Math.max(0, d.count || 0));
  const roll = rollingSum(counts, 7);
  let i = roll.length - 1;
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

/** Convert GitHub contribution calendar (GraphQL) → DayCount[] */
export function fromContributionCalendar(
  weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>
): DayCount[] {
  const out: DayCount[] = [];
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      out.push({ date: toYMD(d.date), count: d.contributionCount || 0 });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Convert REST Events → DayCount[] (approx). Counts events per day for last N days. */
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
  const list: DayCount[] = [];
  let cur = startMs;
  while (cur <= today.getTime()) {
    const ymd = toYMD(cur);
    list.push({ date: ymd, count: buckets.get(ymd) || 0 });
    cur += dayMs;
  }
  return list;
}
