// app/api/duel/route.ts
import {
  fetchUserMetricsGraphQL,
  fetchUserREST,
  fetchReposREST,
} from '@/lib/github';
import { scoreFromGraphQL, scoreFromREST, applyLegendOverride } from '@/lib/score';
import { tierWithBand, textWidth } from '@/lib/rank';
import { themeColors, type Theme } from '@/lib/theme';

export const runtime = 'edge';

type Icon = 'github' | 'saber' | 'galaxy' | 'none';

const GH_LOGO_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38' +
  ' 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15' +
  ' -.72-.49.05-.48.05-.48.79.06 1.2.81 1.2.81.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06' +
  ' -2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32' +
  ' 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17' +
  ' .77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2' +
  ' 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z';

const SABER_ICON = `
  <g transform="translate(8,5)">
    <rect x="0" y="6" width="8" height="6" rx="1.5" fill="#e5e7eb"/>
    <rect x="1" y="7" width="6" height="4" rx="1" fill="#9ca3af"/>
    <rect x="2" y="8" width="4" height="2" rx="1" fill="#4b5563"/>
    <rect x="8" y="7" width="2" height="4" rx="1" fill="#94a3b8"/>
    <rect x="10" y="6" width="6" height="6" rx="1.5" fill="#bbf7d0"/>
    <rect x="10" y="7" width="6" height="4" rx="1.2" fill="#34d399"/>
  </g>
`;
const GALAXY_ICON = `
  <g transform="translate(8,6)">
    <circle cx="6" cy="6" r="5.5" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
    <path d="M6 0 L6 12 M0 6 L12 6 M2.2 2.2 L9.8 9.8 M2.2 9.8 L9.8 2.2"
          stroke="#e5e7eb" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="6" cy="6" r="1.8" fill="#a7f3d0"/>
  </g>
`;

const esc = (s: string) =>
  (s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

function iconMarkup(icon: Icon) {
  if (icon === 'none') return '';
  if (icon === 'github') return `<g transform="translate(0,0)"><path fill="#fff" d="${GH_LOGO_PATH}"/></g>`;
  if (icon === 'saber') return SABER_ICON;
  return GALAXY_ICON;
}

async function computePoints(username: string, token?: string) {
  const gql = await fetchUserMetricsGraphQL(username, token);
  if (gql) {
    return {
      method: 'graphql' as const,
      points: scoreFromGraphQL(gql),
      approxStars: gql.totalStars,
      approxFollowers: gql.followers
    };
  }
  const [u, repos] = await Promise.all([
    fetchUserREST(username, token),
    fetchReposREST(username, token)
  ]);
  const points = scoreFromREST({
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
    events: []
  });
  const approxStars = (repos ?? []).reduce((s: number, r: any) => s + (r?.stargazers_count || 0), 0);
  const approxFollowers = u.followers ?? 0;
  return { method: 'rest' as const, points, approxStars, approxFollowers };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user1 = searchParams.get('user1');
  const user2 = searchParams.get('user2');

  if (!user1 || !user2) {
    return new Response(JSON.stringify({ error: 'Missing ?user1=&user2=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const badge = searchParams.get('badge') !== '0'; // default: SVG
  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const icon1 = (searchParams.get('icon1') ?? 'saber') as Icon;
  const icon2 = (searchParams.get('icon2') ?? 'galaxy') as Icon;

  // Token (Authorization > env)
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

  let a, b;
  try {
    const [pa, pb] = await Promise.all([computePoints(user1, token), computePoints(user2, token)]);
    // Legends override (e.g., Torvalds)
    pa.points = applyLegendOverride(user1, pa.points, pa.approxStars, pa.approxFollowers);
    pb.points = applyLegendOverride(user2, pb.points, pb.approxStars, pb.approxFollowers);

    a = { user: user1, ...pa, ...tierWithBand(pa.points) };
    b = { user: user2, ...pb, ...tierWithBand(pb.points) };
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to compute duel' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!badge) {
    return new Response(JSON.stringify({
      a: { user: a.user, rank: a.tier.grade, persona: a.tier.name, band: a.bandRoman, points: a.points },
      b: { user: b.user, rank: b.tier.grade, persona: b.tier.name, band: b.bandRoman, points: b.points },
      winner: a.points === b.points ? 'tie' : (a.points > b.points ? a.user : b.user)
    }, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // ---- SVG badge ----
  const tc = themeColors(theme);
  const pad = 14;
  const height = 44;

  const leftText  = `${a.user.toUpperCase()} • ${a.tier.grade}`;
  const rightText = `${b.tier.grade} • ${b.user.toUpperCase()}`;
  const leftW  = pad * 2 + (icon1 === 'none' ? 0 : 18) + textWidth(leftText, 'bold');
  const rightW = pad * 2 + (icon2 === 'none' ? 0 : 18) + textWidth(rightText, 'bold');
  const sepW   = 52;
  const totalW = leftW + sepW + rightW;

  const prA = Math.max(0, Math.min(1, (a.pctToNext ?? 0) / 100));
  const prB = Math.max(0, Math.min(1, (b.pctToNext ?? 0) / 100));
  const maxedA = (a.pctToNext ?? 0) <= 0;
  const maxedB = (b.pctToNext ?? 0) <= 0;

  const saberBar = (x: number, w: number, pr: number, color: string, maxed: boolean) => {
    const core = Math.round((w - pad * 2) * (maxed ? 1 : pr));
    return `
      <rect x="${x + pad}" y="${height - 7}" width="${w - pad * 2}" height="4" rx="2" fill="#000000" opacity="0.28"/>
      <rect x="${x + pad}" y="${height - 7}" width="${core}" height="4" rx="2" fill="${esc(color)}" opacity="${maxed? '1' : '0.95'}"/>
    `;
  };

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img" aria-label="Duel: ${esc(a.user)} vs ${esc(b.user)}">
  <title>Duel • ${esc(a.user)} vs ${esc(b.user)}</title>
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <mask id="round"><rect width="${totalW}" height="${height}" rx="6" fill="#fff"/></mask>
  </defs>

  <g mask="url(#round)">
    <rect width="${leftW}" height="${height}" fill="${esc(tc.leftColor)}"/>
    <rect x="${leftW}" width="${sepW}" height="${height}" fill="#0b1020"/>
    <rect x="${leftW + sepW}" width="${rightW}" height="${height}" fill="#111827" opacity="0.18"/>
    <rect width="${totalW}" height="${height}" fill="url(#g)"/>
  </g>

  <!-- Left -->
  ${icon1 === 'none' ? '' : `<g transform="translate(8,6)">${iconMarkup(icon1)}</g>`}
  <text x="${(icon1 === 'none' ? 10 : 28)}" y="17" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="12" font-weight="700" fill="#ffffff">${esc(leftText)}</text>
  <text x="${(icon1 === 'none' ? 10 : 28)}" y="31" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="10" fill="${esc(a.tier.color)}" opacity="0.95">${esc(`${a.tier.name} • ${a.bandRoman}`)}</text>
  ${saberBar(0, leftW, prA, a.tier.color, maxedA)}

  <!-- VS -->
  <g transform="translate(${leftW},0)">
    <text x="${sepW/2}" y="26" text-anchor="middle"
          font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
          font-size="14" font-weight="700" fill="#e5e7eb">VS</text>
  </g>

  <!-- Right -->
  ${icon2 === 'none' ? '' : `<g transform="translate(${leftW + sepW + 8},6)">${iconMarkup(icon2)}</g>`}
  <text x="${leftW + sepW + (icon2 === 'none' ? 10 : 28)}" y="17" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="12" font-weight="700" fill="#ffffff">${esc(rightText)}</text>
  <text x="${leftW + sepW + (icon2 === 'none' ? 10 : 28)}" y="31" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="10" fill="${esc(b.tier.color)}" opacity="0.95">${esc(`${b.bandRoman} • ${b.tier.name}`)}</text>
  ${saberBar(leftW + sepW, rightW, prB, b.tier.color, maxedB)}
</svg>`.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Authorization, Accept-Encoding'
    }
  });
}
