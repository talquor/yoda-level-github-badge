// app/api/qrotator-mini/route.ts
import { themeColors, type Theme } from '@/lib/theme';
import { Q_CONCEPTS, indexForKey } from '@/lib/quantum_concepts';
import { textWidth } from '@/lib/rank';
import {
  fetchUserMetricsGraphQL,
  fetchUserREST,
  fetchReposREST,
  fetchEventsREST,
  fetchContributionCalendar
} from '@/lib/github';
import { scoreFromGraphQL, scoreFromREST, applyLegendOverride } from '@/lib/score';
import { tierWithBand } from '@/lib/rank';
import {
  fromContributionCalendar,
  fromEvents,
  normalizeDays,
  toYMD,
  computeClassicStreak
} from '@/lib/streak';

export const runtime = 'edge';

type Icon = 'github' | 'saber' | 'galaxy' | 'none';

const esc = (s: string) =>
  (s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

const GH_LOGO_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38' +
  ' 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15' +
  ' -.72-.49.05-.48.05-.48.79.06 1.2.81 1.2.81.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06' +
  ' -2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32' +
  ' 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17' +
  ' .77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2' +
  ' 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z';

const SABER_SVG = `
  <g transform="translate(8,5)">
    <rect x="0" y="6" width="8" height="6" rx="1.5" fill="#e5e7eb"/>
    <rect x="1" y="7" width="6" height="4" rx="1" fill="#9ca3af"/>
    <rect x="2" y="8" width="4" height="2" rx="1" fill="#4b5563"/>
    <rect x="8" y="7" width="2" height="4" rx="1" fill="#94a3b8"/>
    <rect x="10" y="6" width="6" height="6" rx="1.5" fill="#bbf7d0"/>
    <rect x="10" y="7" width="6" height="4" rx="1.2" fill="#34d399"/>
  </g>
`;
const GALAXY_SVG = `
  <g transform="translate(8,6)">
    <circle cx="6" cy="6" r="5.5" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
    <path d="M6 0 L6 12 M0 6 L12 6 M2.2 2.2 L9.8 9.8 M2.2 9.8 L9.8 2.2"
          stroke="#e5e7eb" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="6" cy="6" r="1.8" fill="#a7f3d0"/>
  </g>
`;

function iconMarkup(icon: Icon) {
  if (icon === 'none') return '';
  if (icon === 'github') return `<g transform="translate(8,6)"><path fill="#fff" d="${GH_LOGO_PATH}"/></g>`;
  if (icon === 'saber') return SABER_SVG;
  return GALAXY_SVG;
}

function xpColor(pr: number, theme: Theme) {
  if (theme === 'sith') {
    if (pr < 0.25) return '#ef4444';
    if (pr < 0.5) return '#f59e0b';
    if (pr < 0.75) return '#facc15';
    return '#fde047';
  }
  if (pr < 0.25) return '#ef4444';
  if (pr < 0.5) return '#f59e0b';
  if (pr < 0.75) return '#a3e635';
  return '#22c55e';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Visual controls
  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const tc = themeColors(theme);
  const label = (searchParams.get('label') ?? 'Quantum').toUpperCase();
  const icon = (searchParams.get('icon') ?? 'galaxy') as Icon;
  const pad = Math.max(10, Math.min(20, parseInt(searchParams.get('pad') || '14', 10) || 14));
  const dur = Math.max(2, Math.min(20, parseInt(searchParams.get('dur') || '4', 10) || 4)); // sec per frame

  // Data inputs
  const username = searchParams.get('username') || undefined;
  const showStreak = searchParams.get('streak') === '1';
  const streakAnchor = (searchParams.get('streakAnchor') ?? 'lastActive') as 'today' | 'lastActive';

  // XP mode controls (NEW)
  const xpMode = (searchParams.get('xpMode') ?? 'tier') as 'tier' | 'commits';
  const xpPer = Math.max(1, Math.min(1000, parseInt(searchParams.get('xpPer') || '10', 10) || 10)); // XP per commit
  const levelSize = Math.max(10, Math.min(10000, parseInt(searchParams.get('levelSize') || '100', 10) || 100)); // XP per level
  const windowDays = Math.max(7, Math.min(365, parseInt(searchParams.get('windowDays') || '30', 10) || 30)); // rolling window for commits

  // Optional static frame override
  let staticIdx: number | undefined;
  const frameQ = searchParams.get('frame');
  if (frameQ) {
    const n = Number(frameQ);
    if (!Number.isNaN(n)) staticIdx = ((n % Q_CONCEPTS.length) + Q_CONCEPTS.length) % Q_CONCEPTS.length;
    else staticIdx = indexForKey(frameQ);
  }

  // Token (Authorization header or env)
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

  // Compute: XP progress + optional streak
  let pr = 0; // progress ratio 0..1
  let maxed = false;
  let streakDays: number | undefined;

  let titleSuffix = ''; // optional "LVL n" text

  if (username) {
    try {
      if (xpMode === 'tier') {
        // Original behavior: progress within current tier
        const gql = await fetchUserMetricsGraphQL(username, token);
        let points = 0;
        let stars = 0;
        let followers = 0;
        if (gql) {
          points = scoreFromGraphQL(gql);
          stars = gql.totalStars;
          followers = gql.followers;
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
              updated_at: r.updated_at ?? null
            })),
            events: (events ?? []).map((e: any) => ({ type: e.type, created_at: e.created_at }))
          });
          stars = (repos ?? []).reduce((s: number, r: any) => s + (r?.stargazers_count || 0), 0);
          followers = u.followers ?? 0;
        }
        points = applyLegendOverride(username, points, stars, followers);
        const { tier, pctToNext } = tierWithBand(points);
        pr = Math.max(0, Math.min(1, (pctToNext ?? 0) / 100));
        maxed = tier.grade === 'S++' || points >= 98;
        titleSuffix = `LVL ${tier.grade}`;
      } else {
        // NEW: commits → XP → level → progress
        // Pull contributions window (calendar preferred)
        let dayCounts: { date: string; count: number }[] = [];
        const weeks = await fetchContributionCalendar(username, token, windowDays + 1);
        if (weeks) {
          const days = fromContributionCalendar(weeks);
          const minYMD = toYMD(new Date(Date.now() - windowDays * 86400000));
          const maxYMD = toYMD(new Date());
          dayCounts = normalizeDays(days, minYMD, maxYMD);
        } else {
          // REST fallback approx
          const events = await fetchEventsREST(username, token);
          dayCounts = fromEvents(events || [], windowDays);
        }

        const commits = dayCounts.reduce((s, d) => s + (d.count || 0), 0);
        const xp = commits * xpPer;
        const level = Math.floor(xp / levelSize) + 1;
        const into = xp % levelSize;
        pr = Math.max(0, Math.min(1, into / levelSize));
        maxed = false; // levels keep going; no hard max here
        titleSuffix = `LVL ${level}`;
      }

      // streak (GraphQL calendar preferred)
      if (showStreak) {
        try {
          const weeks = await fetchContributionCalendar(username, token, Math.max(windowDays, 120));
          if (weeks) {
            const days = fromContributionCalendar(weeks);
            const minYMD = toYMD(new Date(Date.now() - Math.max(windowDays, 120) * 86400000));
            const maxYMD = toYMD(new Date());
            const normalized = normalizeDays(days, minYMD, maxYMD);
            streakDays = computeClassicStreak(normalized, streakAnchor);
          } else {
            const events = await fetchEventsREST(username, token);
            const approx = fromEvents(events || [], Math.max(windowDays, 120));
            streakDays = computeClassicStreak(approx, streakAnchor);
          }
        } catch {
          streakDays = undefined;
        }
      }
    } catch {
      // ignore failures; still render rotator
    }
  }

  // Layout
  const height = 32; // fits 2 lines + XP bar
  const radius = 4;
  const hasIcon = icon !== 'none';

  const leftText = titleSuffix ? `${label} • ${titleSuffix}` : label;
  const leftTextW = textWidth(leftText, 'bold');
  const leftW = pad * 2 + leftTextW + (hasIcon ? 18 : 0);

  // Right frames = title (uppercased) + tiny equation under
  const titles = Q_CONCEPTS.map(c => `${c.emoji} ${c.title.toUpperCase()}`);
  const eqs    = Q_CONCEPTS.map(c => c.formula);
  const rightW = pad * 2 + Math.max(
    ...titles.map(t => textWidth(t, 'bold')),
    ...eqs.map(e => textWidth(e, 'normal'))
  );
  const totalW = leftW + rightW;

  // SMIL anim
  const L = Q_CONCEPTS.length;
  const totalDur = L * dur;
  const animFor = (idx: number) => {
    const start = (idx * dur) / totalDur;
    const end = ((idx + 1) * dur) / totalDur;
    return `
      <animate attributeName="opacity"
               dur="${totalDur}s"
               repeatCount="indefinite"
               calcMode="discrete"
               keyTimes="0; ${start}; ${end}; 1"
               values="0; 1; 0; 0"/>
    `;
  };

  const frames = Q_CONCEPTS.map((c, i) => {
    const title = `${c.emoji} ${c.title.toUpperCase()}`;
    const eq = c.formula;
    return `
      <g id="rt-${i}" opacity="0">
        <title>${esc(c.title)} — ${esc(c.hint)}</title>
        <text x="${leftW + pad}" y="16" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
              font-size="12" font-weight="700" fill="#ffffff">${esc(title)}</text>
        <text x="${leftW + pad}" y="28" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
              font-size="10" fill="#c7d2fe" opacity="0.95">${esc(eq)}</text>
      </g>
    `;
  });

  // XP bar
  const prClamped = Math.max(0, Math.min(1, pr));
  const xpFill = xpColor(prClamped, theme);
  const barH = 3;
  const barY = height - barH;
  const filledW = Math.round(rightW * (maxed ? 1 : prClamped));

  // Streak
  const streakText = typeof streakDays === 'number' ? `🔥 ${streakDays}d` : '';

  // Static frame?
  if (typeof staticIdx === 'number') {
    const c = Q_CONCEPTS[staticIdx];
    const title = `${c.emoji} ${c.title.toUpperCase()}`;
    const eq = c.formula;

    const svgStatic = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img"
     aria-label="${esc(leftText)}: ${esc(title)}">
  <title>${esc(leftText)} • ${esc(c.title)} — ${esc(c.hint)}</title>
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <mask id="round">
      <rect width="${totalW}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </mask>
  </defs>

  <g mask="url(#round)">
    <rect width="${leftW}" height="${height}" fill="${esc(tc.leftColor)}"/>
    <rect x="${leftW}" width="${rightW}" height="${height}" fill="#111827" opacity="0.18"/>
    <rect width="${totalW}" height="${height}" fill="url(#g)"/>
    <!-- XP -->
    <rect x="${leftW}" y="${barY}" width="${rightW}" height="${barH}" fill="#000000" opacity="0.22"/>
    <rect x="${leftW}" y="${barY}" width="${filledW}" height="${barH}" fill="${esc(xpFill)}" opacity="${maxed ? '1' : '0.95'}"/>
  </g>

  ${hasIcon ? iconMarkup(icon) : ''}

  <g fill="#ffffff" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${hasIcon ? 26 : 12}" y="19">${esc(leftText)}</text>
  </g>

  <g>
    <text x="${leftW + pad}" y="16" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
          font-size="12" font-weight="700" fill="#ffffff">${esc(title)}</text>
    <text x="${leftW + pad}" y="28" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
          font-size="10" fill="#c7d2fe" opacity="0.95">${esc(eq)}</text>
    ${streakText ? `<text x="${leftW + rightW - pad}" y="16" text-anchor="end"
          font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="11" fill="#e5e7eb" opacity="0.95">${esc(streakText)}</text>` : ''}
  </g>
</svg>`.trim();

    return new Response(svgStatic, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Authorization, Accept-Encoding'
      }
    });
  }

  // Animated
  const groups = frames
    .map((g, i) => g.replace('</g>', `${animFor(i)}</g>`))
    .join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img"
     aria-label="${esc(leftText)}: rotating concepts + xp">
  <title>${esc(leftText)} — concepts rotator with XP</title>
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <mask id="round">
      <rect width="${totalW}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </mask>
  </defs>

  <g mask="url(#round)">
    <rect width="${leftW}" height="${height}" fill="${esc(tc.leftColor)}"/>
    <rect x="${leftW}" width="${rightW}" height="${height}" fill="#111827" opacity="0.18"/>
    <rect width="${totalW}" height="${height}" fill="url(#g)"/>
    <!-- XP -->
    <rect x="${leftW}" y="${barY}" width="${rightW}" height="${barH}" fill="#000000" opacity="0.22"/>
    <rect x="${leftW}" y="${barY}" width="${filledW}" height="${barH}" fill="${esc(xpFill)}" opacity="${maxed ? '1' : '0.95'}"/>
  </g>

  ${hasIcon ? iconMarkup(icon) : ''}

  <g fill="#ffffff" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${hasIcon ? 26 : 12}" y="19">${esc(leftText)}</text>
  </g>

  ${groups}

  ${streakText ? `<text x="${leftW + rightW - pad}" y="16" text-anchor="end"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="11" fill="#e5e7eb" opacity="0.95">${esc(streakText)}</text>` : ''}
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
