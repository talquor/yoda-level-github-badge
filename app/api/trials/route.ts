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
  // Optional numbers for tooltips / debug
  stats?: Record<string, number | string>;
};

const esc = (s: string) =>
  (s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

/** Wrap text into max lines by character count (SVG-safe, no foreignObject). */
function wrapLines(text: string, maxChars: number, maxLines: number): { lines: string[]; truncated: boolean } {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length <= maxChars) {
      cur = cur ? cur + ' ' + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const truncated = lines.join(' ').length < (text || '').trim().length;
  if (truncated && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length >= 3 ? last.slice(0, Math.max(0, maxChars - 1)).replace(/\s+$/, '') + '…' : '…';
  }
  return { lines, truncated };
}

/** Parse PR/Issue IDs from events to avoid double-counting. */
function parseEventKey(e: any): { kind: 'pr' | 'issue' | null; key?: string } {
  const type = e?.type;
  const repo = e?.repo?.name || e?.repo?.id;
  if (type === 'PullRequestEvent') {
    const num = e?.payload?.number ?? e?.payload?.pull_request?.number ?? e?.payload?.pullRequest?.number;
    if (repo && Number.isFinite(num)) return { kind: 'pr', key: `pr:${repo}#${num}` };
  }
  if (type === 'IssuesEvent') {
    const num = e?.payload?.issue?.number ?? e?.payload?.number;
    if (repo && Number.isFinite(num)) return { kind: 'issue', key: `issue:${repo}#${num}` };
  }
  return { kind: null };
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
  const title    = esc((searchParams.get('title') ?? 'Yoda Trials').toUpperCase());
  const showLabels = !detailed && searchParams.get('labels') === '1'; // compact labels optional
  const pad = 10;

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

  // ----- Data Gathering (more accurate) -----
  // 1) User + repos for followers/stars
  // 2) Points via GraphQL (preferred) else REST
  // 3) Commits and streak from GraphQL contribution calendar (UTC normalized)
  // 4) Distinct PRs / Issues from REST events within 30 days (approximate best-effort)

  let followers = 0;
  let totalStars = 0;
  let points = 0;
  let commits7d = 0;
  let commits30d = 0;
  let streak = 0;
  let distinctPRs30d = 0;
  let distinctIssues30d = 0;

  try {
    const [u, repos] = await Promise.all([
      fetchUserREST(username, token),
      fetchReposREST(username, token)
    ]);

    followers = u?.followers ?? 0;
    totalStars = (repos ?? []).reduce((s: number, r: any) => s + (r?.stargazers_count || 0), 0);

    // Points: GraphQL preferred
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
        events: [] // not needed here
      });
    }
    points = applyLegendOverride(username, points, totalStars, followers);

    // Contribution calendar (most accurate for commits/streak)
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
      streak     = computeClassicStreak(d30, 'lastActive'); // UTC-safe
    }

    // REST events → distinct PR/Issue counts for last 30 days (best-effort)
    {
      const events = await fetchEventsREST(username, token);
      if (events && Array.isArray(events)) {
        const sinceMs = Date.now() - 30 * 86400000;
        const prKeys = new Set<string>();
        const issueKeys = new Set<string>();

        for (const e of events) {
          const t = new Date(e?.created_at || e?.createdAt || e?.timestamp || Date.now()).getTime();
          if (!Number.isFinite(t) || t < sinceMs) continue;
          const parsed = parseEventKey(e);
          if (parsed.kind === 'pr' && parsed.key) prKeys.add(parsed.key);
          if (parsed.kind === 'issue' && parsed.key) issueKeys.add(parsed.key);
        }
        distinctPRs30d = prKeys.size;
        distinctIssues30d = issueKeys.size;
      }
    }
  } catch (err: any) {
    // tolerate partial data; if totally failed, return error
    if (!followers && !totalStars && !points) {
      return new Response(JSON.stringify({ error: err?.message || 'GitHub data fetch failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // Tier for mastery trial
  const { tier } = tierWithBand(points);

  // ----- Trials (tuned thresholds, accurate counters) -----
  const trials: Trial[] = [
    {
      key: 'padawan',
      emoji: '🧑‍💻',
      name: 'Padawan Learner',
      desc: 'At least 1 commit in the last 7 days.',
      unlocked: commits7d >= 1,
      stats: { commits7d }
    },
    {
      key: 'sith-survivor',
      emoji: '🔥',
      name: 'Sith Survivor',
      desc: 'Maintained a 7+ day commit streak.',
      unlocked: streak >= 7,
      stats: { streak }
    },
    {
      key: 'lightspeed',
      emoji: '⚡',
      name: 'Lightspeed Coder',
      desc: '50+ commits in the last 7 days.',
      unlocked: commits7d >= 50,
      stats: { commits7d }
    },
    {
      key: 'pr-knight',
      emoji: '🛡️',
      name: 'Pull Request Knight',
      desc: '3+ distinct PRs in 30 days.',
      unlocked: distinctPRs30d >= 3,
      stats: { prs30d: distinctPRs30d }
    },
    {
      key: 'bug-buster',
      emoji: '🛠️',
      name: 'Bug Buster',
      desc: '3+ distinct issues in 30 days.',
      unlocked: distinctIssues30d >= 3,
      stats: { issues30d: distinctIssues30d }
    },
    {
      key: 'star-forged',
      emoji: '⭐',
      name: 'Star Forged',
      desc: 'Total 100+ repository stars.',
      unlocked: totalStars >= 100,
      stats: { stars: totalStars }
    },
    {
      key: 'jedi-mastery',
      emoji: '🧙',
      name: 'Jedi Mastery',
      desc: 'Reached S-tier (≥90 points).',
      unlocked: points >= 90 || tier.grade.startsWith('S'),
      stats: { points, grade: tier.grade }
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
      prs30d: distinctPRs30d,
      issues30d: distinctIssues30d,
      trials
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // ------------- SVG RENDERING (overflow-proof) -------------
  // Two modes:
  //  - detailed cards: multi-row grid, wrapped descriptions, clipped to cells
  //  - compact strip: icons only (optional tiny labels)
  const leftBg = tc.leftColor;

  if (detailed) {
    // Card grid layout (no overflow)
    const cols = Math.max(1, Math.min(4, parseInt(searchParams.get('cols') || '3', 10) || 3));
    const cellW = 260;           // wider cards to fit text
    const cellH = 78;            // taller to allow 2 lines of desc
    const gapX = 12, gapY = 12;
    const rows = Math.ceil(trials.length / cols);
    const width = pad * 2 + cols * cellW + (cols - 1) * gapX;
    const height = pad * 2 + 28 /*title*/ + rows * cellH + (rows - 1) * gapY;

    // Build cells
    let cells = '';
    trials.forEach((t, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = pad + c * (cellW + gapX);
      const y = pad + 28 + r * (cellH + gapY);

      const glow = t.unlocked ? (theme === 'sith' ? '#f97316' : '#22c55e') : '#6b7280';
      const nameFill = '#ffffff';
      const descFill = t.unlocked ? '#c7d2fe' : '#9ca3af';
      const badgeBg = t.unlocked ? (theme === 'sith' ? '#3b0a0a' : '#073b2a') : '#0f172a';

      // wrap desc to 2 lines of up to ~40 chars
      const wrapped = wrapLines(t.desc, 40, 2);

      const clipId = `clip-${i}`;
      const titleText = `${t.emoji} ${t.name}`;
      const tooltipStats = t.stats ? ' • ' + Object.entries(t.stats).map(([k, v]) => `${k}:${v}`).join(' ') : '';

      cells += `
        <defs>
          <clipPath id="${clipId}">
            <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8"/>
          </clipPath>
        </defs>
        <g clip-path="url(#${clipId})">
          <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="10" fill="${badgeBg}" stroke="${glow}" stroke-opacity="${t.unlocked ? '0.8' : '0.25'}"/>
          <title>${esc(titleText)} — ${esc(t.desc)}${esc(tooltipStats)}</title>
          <!-- Title -->
          <text x="${x + 12}" y="${y + 24}" font-size="16" font-weight="700" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="${nameFill}">
            ${esc(titleText)}
          </text>
          <!-- Desc (wrapped to 2 lines) -->
          <text x="${x + 12}" y="${y + 42}" font-size="12" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="${descFill}">
            <tspan x="${x + 12}" dy="0">${esc(wrapped.lines[0] ?? '')}</tspan>
            ${wrapped.lines[1] ? `<tspan x="${x + 12}" dy="16">${esc(wrapped.lines[1])}</tspan>` : ''}
          </text>
        </g>
      `;
    });

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${title}">
  <title>${title} — Achievements</title>
  <defs>
    <linearGradient id="bg" x2="0" y2="1">
      <stop offset="0" stop-color="${esc(leftBg)}" stop-opacity="0.18"/>
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

  // Compact strip (icons only) — optionally tiny labels without overflow
  {
    const gap = 6;
    const box = 36;
    const step = box + gap;
    const leftPad = 8;
    const width = leftPad * 2 + trials.length * step - gap;
    const height = showLabels ? 68 : 52;

    const icons = trials.map((t, i) => {
      const x = leftPad + i * step;
      const y = 8;
      const bg = t.unlocked ? (theme === 'sith' ? '#3b0a0a' : '#064e3b') : '#111827';
      const stroke = t.unlocked ? (theme === 'sith' ? '#f97316' : '#22c55e') : '#374151';
      const label = `${t.emoji} ${t.name}`;
      const clipId = `clip-mini-${i}`;

      // Optional one-line label under icon, truncated to 10 chars
      const smallName = t.name.length > 12 ? t.name.slice(0, 11) + '…' : t.name;

      return `
        <defs>
          <clipPath id="${clipId}">
            <rect x="${x}" y="${y}" width="${box}" height="${box}" rx="8"/>
          </clipPath>
        </defs>
        <g>
          <rect x="${x}" y="${y}" width="${box}" height="${box}" rx="8" fill="${bg}" stroke="${stroke}" stroke-opacity="${t.unlocked ? '0.8' : '0.25'}"/>
          <g clip-path="url(#${clipId})">
            <text x="${x + box/2}" y="${y + 23}" text-anchor="middle" font-size="18" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${esc(t.emoji)}</text>
          </g>
          <title>${esc(label)} — ${esc(t.desc)}</title>
          ${showLabels ? `
            <text x="${x + box/2}" y="${y + 48}" text-anchor="middle" font-size="10" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" fill="#c7d2fe">${esc(smallName)}</text>
          ` : ''}
        </g>
      `;
    }).join('\n');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${title}">
  <title>${title} — Compact</title>
  <defs>
    <linearGradient id="bg" x2="0" y2="1">
      <stop offset="0" stop-color="${esc(leftBg)}" stop-opacity="0.18"/>
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
