import { fetchReposREST, fetchEventsREST, fetchUserREST, fetchUserMetricsGraphQL } from '@/lib/github';
import { scoreFromGraphQL, scoreFromREST } from '@/lib/score';
import { pickTierByPoints, TIERS } from '@/lib/rank';
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

  const badge = searchParams.get('badge') === '1'; // return SVG directly
  const label = searchParams.get('label') ?? 'Yoda Rank';
  const logo = searchParams.get('logo') === 'github';
  const token = process.env.GITHUB_TOKEN;

  let points = 0;
  let used = 'rest';

  try {
    // Try GraphQL first (if token provided)
    const gql = await fetchUserMetricsGraphQL(username, token);
    if (gql) {
      points = scoreFromGraphQL(gql);
      used = 'graphql';
    } else {
      // REST fallback
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
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'GitHub fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const tier = pickTierByPoints(points);
  const rightText = `${tier.name} (${tier.grade})`;
  const rightColor = tier.color;

  if (badge) {
    const { svg } = buildBadgeSVG({
      label,
      rightText,
      rightColor,
      withGithubLogo: logo
    });
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=1800, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // JSON response (for debugging / programmatic use)
  return new Response(JSON.stringify({
    username,
    points,
    rank: tier.grade,
    persona: tier.name,
    color: tier.color,
    method: used,
    tiers: TIERS.map(t => ({ grade: t.grade, name: t.name, min: t.min }))
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
