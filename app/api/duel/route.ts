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
  <g transform="translate(0,0)">
    <rect x="0" y="6" width="8" height="6" rx="1.5" fill="#e5e7eb"/>
    <rect x="1" y="7" width="6" height="4" rx="1" fill="#9ca3af"/>
    <rect x="2" y="8" width="4" height="2" rx="1" fill="#4b5563"/>
    <rect x="8" y="7" width="2" height="4" rx="1" fill="#94a3b8"/>
    <rect x="10" y="6" width="6" height="6" rx="1.5" fill="#bbf7d0"/>
    <rect x="10" y="7" width="6" height="4" rx="1.2" fill="#34d399"/>
  </g>
`;
const GALAXY_ICON = `
  <g transform="translate(0,0)">
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
  if (icon === 'github') return `<path fill="#fff" d="${GH_LOGO_PATH}"/>`;
  if (icon === 'saber') return SABER_ICON;
  return GALAXY_ICON;
}

// Measure + fit helpers
function fitTextToWidth(s: string, max: number, bold = false): { text: string; width: number } {
  if (!s) return { text: '', width: 0 };
  let w = textWidth(s, bold ? 'bold' : 'normal');
  if (w <= max) return { text: s, width: w };
  // Ellipsize
  let cut = s.length;
  while (cut > 1) {
    const t = s.slice(0, cut) + '…';
    w = textWidth(t, bold ? 'bold' : 'normal');
    if (w <= max) return { text: t, width: w };
    cut--;
  }
  return { text: '…', width: textWidth('…', bold ? 'bold' : 'normal') };
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

  // Options
  const badge = searchParams.get('badge') !== '0'; // default svg
  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const icon1 = (searchParams.get('icon1') ?? 'saber') as Icon;
  const icon2 = (searchParams.get('icon2') ?? 'galaxy') as Icon;

  // Layout caps (prevent overflow while keeping readability)
  const PAD = 14;
  const HEIGHT = 56;                      // Taller for breathing room
  const SEP_W = 64;                       // VS area
  const ICON_W = (i: Icon) => (i === 'none' ? 0 : 18);
  const MAX_TOTAL = 720;                  // hard cap overall
  const MIN_SIDE = 210;                   // min width per side
  const MAX_SIDE = 300;                   // max width per side before ellipsis

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

  // Compute points/tiers
  let a: any, b: any;
  try {
    const [pa, pb] = await Promise.all([computePoints(user1, token), computePoints(user2, token)]);
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

  const winner =
    a.points === b.points ? 'tie' : (a.points > b.points ? 'left' : 'right');

  if (!badge) {
    return new Response(JSON.stringify({
      a: { user: a.user, rank: a.tier.grade, persona: a.tier.name, band: a.bandRoman, points: a.points },
      b: { user: b.user, rank: b.tier.grade, persona: b.tier.name, band: b.bandRoman, points: b.points },
      winner
    }, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    });
  }

  // Compose labels (2 lines per side)
  const topL  = `${a.user.toUpperCase()}`;
  const botL  = `${a.tier.grade} • ${a.tier.name}`;
  const topR  = `${b.user.toUpperCase()}`;
  const botR  = `${b.tier.grade} • ${b.tier.name}`;

  // Fit to per-side max text widths
  const iconSpaceL = ICON_W(icon1) ? 20 : 0;
  const iconSpaceR = ICON_W(icon2) ? 20 : 0;

  // Max text area per side (cap)
  const MAX_TEXT_L = MAX_SIDE - PAD * 2 - iconSpaceL;
  const MAX_TEXT_R = MAX_SIDE - PAD * 2 - iconSpaceR;

  const fitTopL = fitTextToWidth(topL, MAX_TEXT_L, true);
  const fitBotL = fitTextToWidth(botL, MAX_TEXT_L, false);
  const fitTopR = fitTextToWidth(topR, MAX_TEXT_R, true);
  const fitBotR = fitTextToWidth(botR, MAX_TEXT_R, false);

  const sideW_L = Math.max(
    MIN_SIDE,
    Math.min(
      MAX_SIDE,
      PAD * 2 + iconSpaceL + Math.max(fitTopL.width, fitBotL.width)
    )
  );
  const sideW_R = Math.max(
    MIN_SIDE,
    Math.min(
      MAX_SIDE,
      PAD * 2 + iconSpaceR + Math.max(fitTopR.width, fitBotR.width)
    )
  );

  let totalW = sideW_L + SEP_W + sideW_R;
  // If still too wide, squeeze proportionally by re-fitting
  if (totalW > MAX_TOTAL) {
    const squeeze = (totalW - MAX_TOTAL) / 2; // reduce both sides
    const targetL = Math.max(MIN_SIDE, sideW_L - squeeze);
    const targetR = Math.max(MIN_SIDE, sideW_R - squeeze);

    const maxTextL2 = Math.max(20, targetL - PAD * 2 - iconSpaceL);
    const maxTextR2 = Math.max(20, targetR - PAD * 2 - iconSpaceR);

    const fitTopL2 = fitTextToWidth(topL, maxTextL2, true);
    const fitBotL2 = fitTextToWidth(botL, maxTextL2, false);
    const fitTopR2 = fitTextToWidth(topR, maxTextR2, true);
    const fitBotR2 = fitTextToWidth(botR, maxTextR2, false);

    var _sideW_L = Math.max(MIN_SIDE, PAD * 2 + iconSpaceL + Math.max(fitTopL2.width, fitBotL2.width));
    var _sideW_R = Math.max(MIN_SIDE, PAD * 2 + iconSpaceR + Math.max(fitTopR2.width, fitBotR2.width));
    totalW = _sideW_L + SEP_W + _sideW_R;

    // Apply re-fit versions
    (fitTopL.text as any) = fitTopL2.text; (fitTopL.width as any) = fitTopL2.width;
    (fitBotL.text as any) = fitBotL2.text; (fitBotL.width as any) = fitBotL2.width;
    (fitTopR.text as any) = fitTopR2.text; (fitTopR.width as any) = fitTopR2.width;
    (fitBotR.text as any) = fitBotR2.text; (fitBotR.width as any) = fitBotR2.width;
  }

  // Progress
  const prA = Math.max(0, Math.min(1, (a.pctToNext ?? 0) / 100));
  const prB = Math.max(0, Math.min(1, (b.pctToNext ?? 0) / 100));
  const maxedA = (a.pctToNext ?? 0) <= 0;
  const maxedB = (b.pctToNext ?? 0) <= 0;

  // Theme colors
  const tc = themeColors(theme);
  const leftColor = tc.leftColor;
  const rightShade = '#111827';

  // Winner ribbon
  const ribbonText = winner === 'tie' ? 'TIE' : 'WINNER';
  const ribbonFill = winner === 'tie' ? '#374151' : (winner === 'left' ? a.tier.color : b.tier.color);

  const saberBar = (x: number, w: number, pr: number, color: string, maxed: boolean) => {
    const core = Math.round((w - PAD * 2) * (maxed ? 1 : pr));
    return `
      <rect x="${x + PAD}" y="${HEIGHT - 9}" width="${w - PAD * 2}" height="5" rx="2.5" fill="#000000" opacity="0.28"/>
      <rect x="${x + PAD}" y="${HEIGHT - 9}" width="${core}" height="5" rx="2.5" fill="${esc(color)}" opacity="${maxed? '1' : '0.95'}"/>
    `;
  };

  const glowLeft = winner === 'left' ? `
    <rect x="0" y="0" width="${sideW_L}" height="${HEIGHT}" fill="${esc(a.tier.color)}" opacity="0.07"/>
  ` : '';
  const glowRight = winner === 'right' ? `
    <rect x="${sideW_L + SEP_W}" y="0" width="${sideW_R}" height="${HEIGHT}" fill="${esc(b.tier.color)}" opacity="0.07"/>
  ` : '';

  const iconL = iconMarkup(icon1);
  const iconR = iconMarkup(icon2);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${HEIGHT}" role="img"
     aria-label="Duel: ${esc(a.user)} vs ${esc(b.user)} — ${ribbonText}">
  <title>Duel • ${esc(a.user)} vs ${esc(b.user)} — ${ribbonText}</title>
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <mask id="round"><rect width="${totalW}" height="${HEIGHT}" rx="8" fill="#fff"/></mask>
  </defs>

  <g mask="url(#round)">
    <rect width="${sideW_L}" height="${HEIGHT}" fill="${esc(leftColor)}"/>
    <rect x="${sideW_L}" width="${SEP_W}" height="${HEIGHT}" fill="#0b1020"/>
    <rect x="${sideW_L + SEP_W}" width="${sideW_R}" height="${HEIGHT}" fill="${rightShade}" opacity="0.18"/>
    ${glowLeft}
    ${glowRight}
    <rect width="${totalW}" height="${HEIGHT}" fill="url(#g)"/>
  </g>

  <!-- Winner ribbon -->
  <g transform="translate(${sideW_L},0)">
    <rect x="${(SEP_W/2) - 30}" y="6" width="60" height="14" rx="7" fill="${esc(ribbonFill)}" opacity="0.95"/>
    <text x="${SEP_W/2}" y="17" text-anchor="middle"
          font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
          font-size="10" font-weight="700" fill="#ffffff">${ribbonText}</text>
    <text x="${SEP_W/2}" y="34" text-anchor="middle"
          font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
          font-size="14" font-weight="700" fill="#e5e7eb">VS</text>
  </g>

  <!-- Left -->
  ${icon1 === 'none' ? '' : `<g transform="translate(${8},6)">${iconL}</g>`}
  <text x="${(icon1 === 'none' ? PAD : PAD + 20)}" y="20"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="13" font-weight="700" fill="#ffffff">${esc(fitTopL.text)}</text>
  <text x="${(icon1 === 'none' ? PAD : PAD + 20)}" y="36"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="11" fill="${esc(a.tier.color)}" opacity="0.95">${esc(fitBotL.text)}</text>
  ${saberBar(0, sideW_L, prA, a.tier.color, maxedA)}
  ${winner === 'left' ? `
    <text x="${sideW_L - 16}" y="16" text-anchor="end"
          font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji"
          font-size="14">👑</text>` : ''}

  <!-- Right -->
  ${icon2 === 'none' ? '' : `<g transform="translate(${sideW_L + SEP_W + 8},6)">${iconR}</g>`}
  <text x="${sideW_L + SEP_W + (icon2 === 'none' ? PAD : PAD + 20)}" y="20"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="13" font-weight="700" fill="#ffffff">${esc(fitTopR.text)}</text>
  <text x="${sideW_L + SEP_W + (icon2 === 'none' ? PAD : PAD + 20)}" y="36"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="11" fill="${esc(b.tier.color)}" opacity="0.95">${esc(fitBotR.text)}</text>
  ${saberBar(sideW_L + SEP_W, sideW_R, prB, b.tier.color, maxedB)}
  ${winner === 'right' ? `
    <text x="${totalW - 8}" y="16" text-anchor="end"
          font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji"
          font-size="14">👑</text>` : ''}
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
