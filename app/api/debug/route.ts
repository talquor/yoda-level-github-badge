// app/api/streak-debug/route.ts
import {
  fetchContributionCalendar,
  fetchEventsREST
} from '@/lib/github';
import {
  fromContributionCalendar,
  fromEvents,
  normalizeDays,
  toYMDUTC,
  computeClassicStreak
} from '@/lib/streak';

export const runtime = 'edge';

/**
 * Inspect your day-by-day contribution counts (UTC) and the computed streak.
 *
 * Params:
 *   username (required)
 *   daysBack=120      : window size (30..400)
 *   anchor=today|lastActive (default lastActive)
 *   source=calendar|events|auto  (default auto; calendar preferred)
 *   includePrivate=1  : you must send your own token in Authorization for GH to include private
 *
 * Auth:
 *   Send:  Authorization: Bearer <YOUR_GH_TOKEN>
 *   Without a token, GitHub returns only public contributions.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing ?username=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const daysBack = Math.max(30, Math.min(400, parseInt(searchParams.get('daysBack') || '180', 10) || 180));
  const anchor = (searchParams.get('anchor') || 'lastActive') as 'today' | 'lastActive';
  const source = (searchParams.get('source') || 'auto') as 'auto' | 'calendar' | 'events';

  // Token from header or env
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  let headerToken: string | undefined;
  {
    const parts = authHeader.split(/\s+/);
    if (parts.length >= 2) {
      const scheme = parts[0].toLowerCase();
      if (scheme === 'bearer' || scheme === 'token') headerToken = parts[1]?.trim();
    }
  }
  const token = headerToken || process.env.GITHUB_TOKEN;

  // Try calendar first (unless source=events)
  let used: 'calendar' | 'events' = 'calendar';
  let dense: { date: string; count: number }[] = [];
  let rawDays: { date: string; count: number }[] = [];

  try {
    if (source !== 'events') {
      const weeks = await fetchContributionCalendar(username, token, daysBack);
      if (weeks) {
        rawDays = fromContributionCalendar(weeks);
        const minYMD = toYMDUTC(new Date(Date.now() - daysBack * 86400000));
        const maxYMD = toYMDUTC(new Date());
        dense = normalizeDays(rawDays, minYMD, maxYMD);
      } else if (source === 'calendar') {
        // forced calendar but none available
        throw new Error('Calendar unavailable from GitHub API');
      } else {
        used = 'events';
      }
    } else {
      used = 'events';
    }

    if (used === 'events') {
      const events = await fetchEventsREST(username, token);
      rawDays = fromEvents(events || [], daysBack);
      dense = rawDays; // fromEvents already normalized for the window
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'GitHub fetch failed (calendar/events)' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const utcToday = toYMDUTC(new Date());
  const streak = computeClassicStreak(dense, anchor);

  // Also compute both anchors for clarity
  const streakToday = computeClassicStreak(dense, 'today');
  const streakLastActive = computeClassicStreak(dense, 'lastActive');

  // Slice last ~30 days view for readability
  const recent = dense.slice(-30);

  return new Response(JSON.stringify({
    username,
    used,                          // 'calendar' (preferred) or 'events'
    note:
      'If you did not send your own token, private contributions are NOT included by GitHub.',
    anchorUsed: anchor,
    utcToday,
    streak,
    streak_today: streakToday,
    streak_lastActive: streakLastActive,
    daysBack,
    recent30: recent,              // array of { date: 'YYYY-MM-DD (UTC)', count: number }
    fullWindow: dense              // full normalized window (UTC)
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
