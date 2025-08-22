// lib/streak.ts

/** Public types */
export type DayCount = { date: string; count: number };

/** UTC-safe YYYY-MM-DD for any Date/string input */
export function toYMDUTC(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today in UTC (GitHub contribution calendar uses day keys in UTC) */
export function todayYMDUTC(): string {
  return toYMDUTC(new Date());
}

/**
 * Normalize a sparse list of {date:YYYY-MM-DD,count} to a dense, inclusive
 * range [minYMD, maxYMD] in UTC.
 */
export function normalizeDays(
  days: DayCount[],
  minYMD: string,
  maxYMD: string
): DayCount[] {
  const map = new Map<string, number>();
  for (const d of days) {
    map.set(toYMDUTC(d.date), (d.count ?? 0) | 0);
  }

  const out: DayCount[] = [];
  const start = new Date(minYMD + 'T00:00:00Z').getTime();
  const end   = new Date(maxYMD + 'T00:00:00Z').getTime();
  const dayMs = 86400000;

  for (let t = start; t <= end; t += dayMs) {
    const ymd = toYMDUTC(new Date(t));
    out.push({ date: ymd, count: map.get(ymd) ?? 0 });
  }
  return out;
}

/** Build from GraphQL contribution calendar weeks->days */
export function fromContributionCalendar(
  weeks: { contributionDays: { date: string; contributionCount: number }[] }[]
): DayCount[] {
  const out: DayCount[] = [];
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      out.push({ date: toYMDUTC(d.date), count: d.contributionCount | 0 });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Approximate from REST events (PushEvent etc.), binned per UTC day */
export function fromEvents(events: any[], windowDays: number): DayCount[] {
  const nowUTC = todayYMDUTC();
  const minUTC = toYMDUTC(new Date(Date.now() - windowDays * 86400000));
  const bin = new Map<string, number>();
  for (const e of events || []) {
    const ymd = toYMDUTC(e?.created_at || e?.createdAt || e?.timestamp || new Date());
    bin.set(ymd, (bin.get(ymd) ?? 0) + 1);
  }
  return normalizeDays(
    Array.from(bin, ([date, count]) => ({ date, count })),
    minUTC,
    nowUTC
  );
}

/**
 * Classic streak:
 * - anchor = 'today'       -> walk back from today UTC
 * - anchor = 'lastActive'  -> walk back from the latest date with count>0
 * Count consecutive days with count>0 with no 0-day gaps.
 */
export function computeClassicStreak(
  days: DayCount[],
  anchor: 'today' | 'lastActive' = 'lastActive'
): number {
  if (!days.length) return 0;

  let idx: number;

  if (anchor === 'today') {
    idx = days.length - 1; // last item is today UTC due to normalizeDays()
  } else {
    // find last active day
    idx = -1;
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i].count ?? 0) > 0) { idx = i; break; }
    }
    if (idx === -1) return 0; // no activity at all
  }

  let streak = 0;
  for (let i = idx; i >= 0; i--) {
    if ((days[i].count ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

/**
 * "Momentum" streak example:
 * - counts a day if there is any activity in last 2 days rolling window
 *   (simple engagement metric)
 */
export function computeMomentumStreak(days: DayCount[]): number {
  if (!days.length) return 0;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const c0 = days[i]?.count ?? 0;
    const c1 = days[i - 1]?.count ?? 0;
    if (c0 + c1 > 0) streak++;
    else break;
  }
  return streak;
}
