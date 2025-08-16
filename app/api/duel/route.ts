// app/api/duel/route.ts
import {
  fetchReposREST,
  fetchEventsREST,
  fetchUserREST,
  fetchUserMetricsGraphQL,
} from '@/lib/github';
import {
  scoreFromGraphQL,
  scoreFromREST,
  applyLegendOverride,
} from '@/lib/score';
import { tierWithBand } from '@/lib/rank';
import { buildBadgeSVG } from '@/lib/badge';

export const runtime = 'edge';

type XPParam = 'dots' | 'bar' | 'none';

async function scoreUser(username: string, token?: string) {
  let points = 0;
  let method: 'rest' | 'graphql' = 'rest';
  let stars = 0;
  let followers = 0;

  try {
    const gql = await fetchUserMetricsGraphQL(username, token);
    if (gql) {
      points = scoreFromGraphQL(gql);
      method = 'graphql';
      stars = gql.totalStars;
      followers = gql.followers;
    } else {
      const [u, repos, events] = await Promise.all([
        fetchUserREST(username, token),
        fetchReposREST(username, token),
        fetchEventsREST(username, token),
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
        events: (events ?? []).map((e: any) => ({
          type: e.type,
          created_at: e.created_at,
        })),
      });

      stars = (repos ?? []).reduce(
        (s: number, r: any) => s + (r?.stargazers_count || 0),
        0
      );
      followers = u.followers ?? 0;
    }
  } catch {
    // swallow errors → keep defaults (points = 0)
  }

  points = applyLegendOverride(username, points, stars, followers);
  const band = tierWithBand(points);
  return { username, points, band, method };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u1 = searchParams.get('u1');
  const u2 = searchParams.get('u2');
  const theme = (searchParams.get('theme') ?? 'jedi') as 'jedi' | 'sith';
  const logo = (searchParams.get('logo') ?? 'galaxy') as 'github' | 'saber' | 'galaxy';
  const xp = (searchParams.get('xp') ?? 'bar') as XPParam; // 'dots' | 'bar' | 'none'
  const label = searchParams.get('label') ?? 'Rank Duel';

  if (!u1 || !u2) {
    return new Response(JSON.stringify({ error: 'Missing ?u1=&u2=' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Authorization, Accept-Encoding'
      },
    });
  }

  // Token: Authorization header > env
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  let headerToken: string | undefined;
  {
    const parts = authHeader.split(/\s+/);
    if (parts.length >= 2) {
      const scheme = parts[0].toLowerCase();
      if (scheme === 'bearer' || scheme === 'token') {
        headerToken = parts[1]?.trim();
      }
    }
  }
  const token = headerToken || process.env.GITHUB_TOKEN;

  const [A, B] = await Promise.all([scoreUser(u1, token), scoreUser(u2, token)]);

  // Winner (or tie)
  const winner = A.points === B.points ? null : A.points > B.points ? A : B;

  // Build two badges (SVG fragments)
  const make = (x: typeof A) => {
    const rightText = `${x.band.tier.name} (${x.band.tier.grade}) • ${x.band.bandRoman} • ${x.points.toFixed(1)} pts`;
    const progressRatio = xp === 'none' ? undefined : (x.band.pctToNext ?? 0) / 100;
    const progressVariant = xp === 'none' ? undefined : (xp as 'dots' | 'bar');

    const { svg, width, height } = buildBadgeSVG({
      label: x.username,
      rightText,
      rightColor: x.band.tier.color,
      icon: logo,
      progressRatio,
      progressVariant,
      theme,
      decorateMaxed: x.band.tier.grade === 'S++' || x.points >= 98
    });
    return { svg, width, height };
  };

  const aSVG = make(A);
  const bSVG = make(B);

  const gap = 18;
  const w = Math.max(aSVG.width, bSVG.width);
  const h = aSVG.height + bSVG.height + gap + 34;

  const title = winner ? `Winner: ${winner.username}` : 'It’s a tie!';
  const doc = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${esc(label)}: ${esc(title)}">
  <title>${esc(label)}: ${esc(title)}</title>
  <defs>
    <linearGradient id="sep" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.0"/>
      <stop offset="1" stop-opacity="0.12"/>
    </linearGradient>
  </defs>
  <g>
    <text x="0" y="16" fill="#e5e7eb" font-size="14" font-weight="700" font-family="Verdana, DejaVu Sans, Geneva, sans-serif">${esc(
      label.toUpperCase()
    )} — ${esc(title)}</text>
    <rect x="0" y="20" width="${w}" height="2" fill="url(#sep)"/>
    <g transform="translate(0,26)">${aSVG.svg}</g>
    <g transform="translate(0,${26 + aSVG.height + gap})">${bSVG.svg}</g>
  </g>
</svg>`.trim();

  return new Response(doc, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Authorization, Accept-Encoding'
    }
  });
}

function esc(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
