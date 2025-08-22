// app/api/user-rank/route.ts
import {
  fetchReposREST,
  fetchEventsREST,
  fetchUserREST,
  fetchUserMetricsGraphQL,
  fetchContributionCalendar
} from '@/lib/github';
import { scoreFromGraphQL, scoreFromREST, applyLegendOverride } from '@/lib/score';
import { TIERS, tierWithBand } from '@/lib/rank';
import { buildBadgeSVG } from '@/lib/badge';
import {
  computeClassicStreak,
  computeMomentumStreak,
  fromContributionCalendar,
  fromEvents,
  normalizeDays,
  toYMDUTC
} from '@/lib/streak';

export const runtime = 'edge';

type StreakMode = 'classic' | 'momentum';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing ?username=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const badge = searchParams.get('badge') === '1';
  const label = searchParams.get('label') ?? 'Rank';
  const logo = (searchParams.get('logo') ?? 'saber') as 'github' | 'saber' | 'galaxy';
  const theme = (searchParams.get('theme') ?? 'jedi') as 'jedi' | 'sith';

  const granular   = searchParams.get('granular') === '1';
  const showPoints = searchParams.get('showPoints') === '1';
  const showNext   = searchParams.get('showNext') === '1';
  const xpParam    = (searchParams.get('xp') ?? 'dots') as 'dots' | 'bar' | 'none';

  // Streak controls
  const showStreak   = searchParams.get('streak') === '1';
  const streakMode   = (searchParams.get('streakMode') ?? 'classic') as StreakMode;
  const streakAnchor = (searchParams.get('streakAnchor') ?? 'lastActive') as 'today' | 'lastActive';
  const streakDaysBack = Math.max(30, Math.min(365, parseInt(searchParams.get('streakWindow') || '120', 10) || 120));

  // 🔐 Token priority: Authorization header > env
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const headerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.split(/\s+/)[1]
    : undefined;
  const token = headerToken || process.env.GITHUB_TOKEN;

  let points = 0;
  let used = 'rest';
  let approxStars = 0;
  let approxFollowers = 0;

  try {
    const gql = await fetchUserMetricsGraphQL(username, token);
    if (gql) {
      points = scoreFromGraphQL(gql);
      used = 'graphql';
      approxStars = gql.totalStars;
      approxFollowers = gql.followers;
    } else {
      const [u, repos, events] = await Promise.all([
        fetchUserREST(username, token),
        fetchReposREST(username, token),
        fetchEventsREST(username, token)
      ]);

      points = scoreFromREST({
        followers: u.followers ?? 0,
        publicRepos: u.public_repos ?? 0,
        createdAt: u.created_at ?? new Date().toISOString(),
        repos: (repos ?? []).map((r: any) => ({
          stargazers_count: r.stargazers_count ?? 0,
          forks_count: r.forks_count ?? 0,
          language: r.language ?? null,
          pushed_at: r.pushed_at ?? null,
          updated_at: r.updated_at ?? null,
        })),
        events: (events ?? []).map((e: any) => ({ type: e.type, created_at: e.created_at }))
      });

      approxStars = (repos ?? []).reduce((s: number, r: any) => s + (r?.stargazers_count || 0), 0);
      approxFollowers = u.followers ?? 0;
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'GitHub fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Legends override (e.g., Torvalds)
  points = applyLegendOverride(username, points, approxStars, approxFollowers);

  const { tier, bandRoman, nextTier, pointsToNext, pctToNext } = tierWithBand(points);
  const progressRatio = Math.max(0, Math.min(1, (pctToNext ?? 0) / 100));

  // STREAK: GraphQL calendar preferred; REST events fallback
  let streakDays: number | undefined = undefined;
  if (showStreak) {
    try {
      const weeks = await fetchContributionCalendar(username, token, streakDaysBack);
      if (weeks) {
        const days = fromContributionCalendar(weeks);
        const minYMD = toYMDUTC(new Date(Date.now() - streakDaysBack * 86400000));
        const maxYMD = toYMDUTC(new Date());
        const normalized = normalizeDays(days, minYMD, maxYMD);
        streakDays =
          streakMode === 'momentum'
            ? computeMomentumStreak(normalized)
            : computeClassicStreak(normalized, streakAnchor);
      } else {
        const events = await fetchEventsREST(username, token);
        const approxDays = fromEvents(events || [], streakDaysBack);
        streakDays =
          streakMode === 'momentum'
            ? computeMomentumStreak(approxDays)
            : computeClassicStreak(approxDays, streakAnchor);
      }
    } catch {
      streakDays = undefined;
    }
  }

  // Right-side text
  const parts = [ granular ? `${tier.name} (${tier.grade}) • ${bandRoman}` : `${tier.name} (${tier.grade})` ];
  if (showPoints) parts.push(`${points.toFixed(1)} pts`);
  if (showNext && nextTier && pointsToNext !== undefined) parts.push(`+${pointsToNext.toFixed(1)} to ${nextTier.name}`);
  if (showStreak && typeof streakDays === 'number') parts.push(`🔥 ${streakDays}d streak`);
  const rightText = parts.join(' • ');

  // 🎖️ Maxed-out decoration for Yoda / S++
  const isMaxed = tier.grade === 'S++' || points >= 98;

  if (badge) {
    const { svg } = buildBadgeSVG({
      label,
      rightText,
      rightColor: tier.color,
      icon: logo,
      progressRatio: xpParam === 'none' ? undefined : (isMaxed ? 1 : progressRatio),
      progressVariant: xpParam === 'bar' ? 'bar' : 'dots',
      theme,
      decorateMaxed: isMaxed
    });
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=1200, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return new Response(JSON.stringify({
    username,
    points,
    rank: tier.grade,
    persona: tier.name,
    color: tier.color,
    method: used,
    streak: showStreak ? { mode: streakMode, days: streakDays } : undefined,
    granular: { band: bandRoman, nextTier: nextTier?.name, pointsToNext, pctWithinTier: pctToNext },
    tiers: TIERS.map(t => ({ grade: t.grade, name: t.name, min: t.min }))
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
