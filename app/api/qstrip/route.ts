// app/api/qstrip/route.ts
import { fetchContributionCalendar, fetchEventsREST } from '@/lib/github';
import { fromContributionCalendar, fromEvents, normalizeDays, toYMD } from '@/lib/streak';
import { themeColors, type Theme } from '@/lib/theme';
import { conceptForIndex } from '@/lib/quantum_concepts';

export const runtime = 'edge';

type WindowSize = 8 | 16 | 32;

function esc(s: string) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function colorFor(v01: number, theme: Theme) {
  // simple readable ramp: red -> amber -> lime -> green (Jedi)
  if (theme === 'sith') {
    if (v01 < 0.25) return '#7f1d1d';
    if (v01 < 0.50) return '#b91c1c';
    if (v01 < 0.75) return '#ef4444';
    return '#f59e0b';
  } else {
    if (v01 < 0.25) return '#7f1d1d';
    if (v01 < 0.50) return '#f59e0b';
    if (v01 < 0.75) return '#a3e635';
    return '#22c55e';
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing ?username=' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const showFooter = searchParams.get('edu') === '1';         // show today concept explainer
  const wRaw = parseInt(searchParams.get('window') || '16', 10);
  const windowSize: WindowSize = (wRaw === 8 || wRaw === 16 || wRaw === 32) ? (wRaw as WindowSize) : 16;

  // Token: Authorization header > env (support Bearer and legacy token)
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

  // Pull contributions
  let counts: number[] = [];
  try {
    const daysBack = Math.max(60, windowSize); // enough history
    const weeks = await fetchContributionCalendar(username, token, daysBack);
    if (weeks) {
      const days = fromContributionCalendar(weeks);
      const minYMD = toYMD(new Date(Date.now() - daysBack * 86400000));
      const maxYMD = toYMD(new Date());
      const normalized = normalizeDays(days, minYMD, maxYMD);
      counts = normalized.slice(-windowSize).map(d => d.count || 0);
    } else {
      // REST fallback
      const events = await fetchEventsREST(username, token);
      const approx = fromEvents(events || [], windowSize);
      counts = approx.slice(-windowSize).map(d => d.count || 0);
    }
  } catch {
    counts = new Array(windowSize).fill(0);
  }

  // Scale counts to 0..1 for fill intensity
  const maxC = Math.max(1, ...counts);
  const vals = counts.map(c => clamp01(c / maxC));

  // layout
  const tc = themeColors(theme);
  const cell = 12;      // width per day
  const gap = 2;
  const pad = 10;
  const hCell = 26;     // cell height
  const footerH = showFooter ? 24 : 0;

  const width = pad * 2 + windowSize * cell + (windowSize - 1) * gap;
  const height = pad * 2 + hCell + footerH;

  // Build cells + tooltips
  const todayIndexStart = Date.now(); // just to vary concept rotation each render
  const cells: string[] = [];
  for (let i = 0; i < windowSize; i++) {
    const x = pad + i * (cell + gap);
    const y = pad;
    const v = vals[i];
    const c = counts[i];
    const concept = conceptForIndex(i);
    const fill = colorFor(v, theme);

    const label = `${concept.emoji} ${concept.title} — ${concept.hint} • ${c} contribution${c===1?'':'s'}`;
    cells.push(`
      <g>
        <title>${esc(label)}</title>
        <rect x="${x}" y="${y}" width="${cell}" height="${hCell}" rx="3" fill="${fill}" opacity="${0.92}"/>
        <text x="${x + cell/2}" y="${y + hCell - 6}" text-anchor="middle"
              font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="10" fill="#ffffff" opacity="0.95">
          ${esc(concept.emoji)}
        </text>
      </g>
    `);
  }

  // Footer: today’s concept with sentence
  let footer = '';
  if (showFooter) {
    const todayConcept = conceptForIndex(windowSize - 1);
    const text = `${todayConcept.emoji} ${todayConcept.title}: ${todayConcept.hint}`;
    footer = `
      <text x="${pad}" y="${pad + hCell + 16}"
            font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" fill="#e5e7eb">
        ${esc(text)}
      </text>
    `;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="Quantum Strip for ${esc(username)}">
  <title>Quantum Strip — ${esc(username)}</title>
  <defs>
    <linearGradient id="shine" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="1" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${esc(tc.leftColor)}"/>
  <rect width="${width}" height="${height}" fill="url(#shine)"/>
  ${cells.join('\n')}
  ${footer}
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
