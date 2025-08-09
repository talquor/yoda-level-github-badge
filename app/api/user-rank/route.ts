import { fetchReposREST, fetchEventsREST, fetchUserREST, fetchUserMetricsGraphQL } from '@/lib/github';
import { scoreFromGraphQL, scoreFromREST, applyLegendOverride } from '@/lib/score';
import { pickTierByPoints, TIERS, tierWithBand } from '@/lib/rank';
import { buildBadgeSVG } from '@/lib/badge';

export const runtime = 'edge';

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

  const granular = searchParams.get('granular') === '1';
  const showPoints = searchParams.get('showPoints') === '1';
  const showNext = searchParams.get('showNext') === '1';

  const token = process.env.GITHUB_TOKEN;

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

  points = applyLegendOverride(username, points, approxStars, approxFollowers);

  // Build right-hand text with optional band/points/next
  const { tier, bandRoman, nextTier, pointsToNext } = tierWithBand(points);
  const baseRight = granular ? `${tier.name} (${tier.grade}) • ${bandRoman}` : `${tier.name} (${tier.grade})`;
  const parts = [baseRight];
  if (showPoints) parts.push(`${points.toFixed(1)} pts`);
  if (showNext && nextTier && pointsToNext !== undefined) {
    parts.push(`+${pointsToNext.toFixed(1)} to ${nextTier.name}`);
  }
  const rightText = parts.join(' • ');
  const rightColor = tier.color;

  if (badge) {
    const { svg } = buildBadgeSVG({
      label,
      rightText,
      rightColor,
      icon: logo
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
    granular: granular ? { band: bandRoman, nextTier: nextTier?.name, pointsToNext } : undefined,
    tiers: TIERS.map(t => ({ grade: t.grade, name: t.name, min: t.min }))
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
