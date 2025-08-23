 // app/api/trials/route.ts
import { themeColors, type Theme } from '@/lib/theme';
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
  normalizeDays,
  toYMDUTC,
  computeClassicStreak
} from '@/lib/streak';

export const runtime = 'edge';

type Mode = 'svg' | 'json';

type Trial = {
  key: string;
  emoji: string;
  name: string;
  desc: string;
  unlocked: boolean;
};

const esc = (s: string) =>
  (s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Inputs
  const username = searchParams.get('username');
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing ?username=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const mode: Mode = searchParams.get('json') === '1' ? 'json' : 'svg';
  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const tc = themeColors(theme);

  // Layout params
  const detailed = searchParams.get('detailed') === '1';
  const compact  = !detailed && searchParams.get('compact') === '1';
  const cols     = Math.max(1, Math.min(6, parseInt(searchParams.get('cols') || (detailed ? '3' : '6'), 10) || (detailed ? 3 : 6)));
  const title    = esc((searchParams.get('title') ?? 'Yoda Trials').toUpperCase());

  // 🔐 Token via Authorization header or env
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

  // Gather data
  let followers = 0;
  let totalStars = 0;
  let points = 0;
  let commits7d = 0;
  let commits30d = 0;
  let streak = 0;
  let prEvents30d = 0;
  let issuesEvents30d = 0;

  try {
    // user profile + repos
    const [u, repos] = await Promise.all([
      fetchUserREST(username, token),
      fetchReposREST(username, token)
    ]);

    followers = u?.followers ?? 0;
    totalStars = (repos ?? []).reduce((s: number, r: any) => s + (r?.stargazers_count || 0), 0);

    // points via GraphQL (preferred) or REST fallback
    const gql = await fetchUserMetricsGraphQL(username, token);
    if (gql) {
      points = scoreFromGraphQL(gql);
    } else {
      points = scoreFromREST({
        followers: u?.followers ?? 0,
        publicRepos: u?.public_repos ?? 0,
        createdAt: u?.created_at ?? new Date().toISOString(),
        repos: (repos ?? []).map((r: any) => ({
          stargazers_count: r.stargazers_count ?? 0,
          forks_count: r.forks_count ?? 0,
          language: r.language ?? null,
          pushed_at: r.pushed_at ?? null,
          updated_at: r.updated_at ?? null
        })),
        events: [] // not required for score fallback here
      });
    }
    points = applyLegendOverride(username, points, totalStars, followers);

    // contribution calendar → commits + streak
    const weeks = await fetchContributionCalendar(username, token, 120);
    if (weeks) {
      const days = fromContributionCalendar(weeks);
      const minYMD30 = toYMDUTC(new Date(Date.now() - 30 * 86400000));
      const minYMD7  = toYMDUTC(new Date(Date.now() - 7  * 86400000));
      const maxYMD   = toYMDUTC(new Date());
      const d30 = normalizeDays(days, minYMD30, maxYMD);
      const d7  = normalizeDays(days, minYMD7,  maxYMD);

      commits30d = d30.reduce((s, d) => s + (d.count || 0), 0);
      commits7d  = d7.reduce((s, d) => s + (d.count || 0), 0);

      // classic streak, anchored at last active day
      streak = computeClassicStreak(d30, 'lastActive');
    }

    // events (approximate PR/issue activity over 30 days)
    const events = await fetchEventsREST(username, token);
    if (events && Array.isArray(events)) {
      const sinceMs = Date.now() - 30 * 86400000;
      for (const e of events) {
        const created = new Date(e?.created_at || e?.createdAt || Date.now()).getTime();
        if (Number.isFinite(created) && created >= sinceMs) {
          if (e?.type === 'PullRequestEvent') prEvents30d++;
          if (e?.type === 'IssuesEvent') issuesEvents30d++;
        }
      }
    }
  } catch (err: any) {
    // tolerate partial data; if totally failed, return an error
    if (!followers && !totalStars && !points) {
      return new Response(JSON.stringify({ error: err?.message || 'GitHub data fetch failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // Evaluate tier (optional badge)
  const { tier } = tierWithBand(points);

  // Trials (achievements)
  const trials: Trial[] = [
    {
      key: 'padawan',
      emoji: '🧑‍💻',
      name: 'Padawan Learner',
      desc: 'Made at least 1 commit in the last 7 days.',
      unlocked: commits7d >= 1
    },
    {
      key: 'sith-survivor',
      emoji: '🔥',
      name: 'Sith Survivor',
      desc: 'Maintained a 7+ day commit streak.',
      unlocked: streak >= 7
    },
    {
      key: 'lightspeed',
      emoji: '⚡',
      name: 'Lightspeed Coder',
      desc: '50+ commits across the last 7 days.',
      unlocked: commits7d >= 50
    },
    {
      key: 'pr-knight',
      emoji: '🛡️',
      name: 'Pull Request Knight',
      desc: 'Opened or interacted with 3+ PRs in 30 days.',
      unlocked: prEvents30d >= 3
    },
    {
      key: 'bug-buster',
      emoji: '🛠️',
      name: 'Bug Buster',
      desc: 'Closed or worked on 3+ issues in 30 days.',
      unlocked: issuesEvents30d >= 3
    },
    {
      key: 'star-forged',
      emoji: '⭐',
      name: 'Star Forged',
      desc: 'Earned a total of 100+ repo stars.',
      unlocked: totalStars >= 100
    },
    {
      key: 'jedi-mastery',
      emoji: '🧙',
      name: 'Jedi Mastery',
      desc: 'Reached high rank (90+ points).',
      unlocked: points >= 90 || tier.grade.startsWith('S')
    }
  ];

  if (mode === 'json') {
    return new Response(JSON.stringify({
      username,
      followers,
      totalStars,
      points,
      commits7d,
      commits30d,
      streak,
      trials
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // ---------- SVG RENDERING ----------

  // Layout metrics
  const pad = 10;

  // Detailed card mode
  if (detailed) {
    const cellW = 220;
    const cellH = 64;
    const rows = Math.ceil(trials.length / cols);
    const width = cellW * cols + pad * 2;
    const height = cellH * rows + pad * 2 + 30; // + title

    let cells = '';
    trials.forEach((t, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = pad + c * cellW;
      const y = pad + 30 + r * cellH;

      const glow = t.unlocked ? (theme === 'sith' ? '#f97316' : '#22c55e') : '#6b7280';
      const nameFill = '#ffffff';
      const descFill = t.unlocked ? '#c7d2fe' : '#9ca3af';
      const badgeBg = t.unlocked ? (theme === 'sith' ? '#3b0a0a' : '#073b2a') : '#0f172a';

      cells += `
        <g transform="translate(${x},${y})">
          <rect width="${cellW - 8}" height="${cellH - 8}" rx="8" fill="${badgeBg}" stroke="${glow}" stroke-opacity="${t.unlocked ? '0.8' : '0.25'}"/>
          <text x="12" y="22" font-size="16" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="${nameFill}">
            ${esc(t.emoji)} ${esc(t.name)}
          </text>
          <text x="12" y="40" font-size="12" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="${descFill}">
            ${esc(t.desc)}
          </text>
        </g>
      `;
    });

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${title}">
  <title>${title} — Achievements</title>
  <defs>
    <linearGradient id="bg" x2="0" y2="1">
      <stop offset="0" stop-color="${esc(tc.leftColor)}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="10"/>
  <text x="${pad}" y="${pad + 16}" font-size="14" font-weight="700" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="#ffffff">${title}</text>
  ${cells}
</svg>`.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=900, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Authorization, Accept-Encoding'
      }
    });
  }

  // Compact strip mode (or default strip if not detailed and not explicitly compact)
  {
    const icons = trials.map((t, i) => {
      const x = 8 + i * 44;
      const bg = t.unlocked ? (theme === 'sith' ? '#3b0a0a' : '#064e3b') : '#111827';
      const stroke = t.unlocked ? (theme === 'sith' ? '#f97316' : '#22c55e') : '#374151';
      const label = `${t.emoji} ${t.name}`;
      return `
        <g transform="translate(${x}, 8)">
          <rect width="36" height="36" rx="8" fill="${bg}" stroke="${stroke}" stroke-opacity="${t.unlocked ? '0.8' : '0.25'}"/>
          <text x="18" y="23" text-anchor="middle" font-size="18" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${esc(t.emoji)}</text>
          <title>${esc(label)} — ${esc(t.desc)}</title>
        </g>
      `;
    }).join('\n');

    const width = trials.length * 44 + 16;
    const height = 52;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${title}">
  <title>${title} — Compact</title>
  <defs>
    <linearGradient id="bg" x2="0" y2="1">
      <stop offset="0" stop-color="${esc(tc.leftColor)}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="10"/>
  ${icons}
</svg>`.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=900, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Authorization, Accept-Encoding'
      }
    });
  }
}
