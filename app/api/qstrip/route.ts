// app/api/qstrip/route.ts
import { fetchContributionCalendar, fetchEventsREST } from '@/lib/github';
import { fromContributionCalendar, fromEvents, normalizeDays, toYMD } from '@/lib/streak';
import { themeColors, type Theme } from '@/lib/theme';
import { conceptForIndex, Q_CONCEPTS } from '@/lib/quantum_concepts';

export const runtime = 'edge';

type WindowSize = 8 | 16 | 32;
type Size = 'sm' | 'md' | 'lg';

function esc(s: string) {
  return (s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
const clamp01 = (x:number)=>Math.max(0,Math.min(1,x));

function colorFor(v01: number, theme: Theme) {
  // readable ramp on GitHub (dark & light)
  if (theme === 'sith') {
    if (v01 < 0.25) return '#7f1d1d';
    if (v01 < 0.50) return '#b91c1c';
    if (v01 < 0.75) return '#ef4444';
    return '#f59e0b';
  }
  if (v01 < 0.25) return '#7f1d1d';
  if (v01 < 0.50) return '#f59e0b';
  if (v01 < 0.75) return '#a3e635';
  return '#22c55e';
}

function parseFocus(param: string | null, windowSize: number) {
  if (!param) return 'today' as const;
  const key = param.toLowerCase();
  if (key === 'today') return 'today' as const;
  const idx = Number(param);
  if (!isNaN(idx) && idx >= 0 && idx < windowSize) return idx;
  const idxByKey = Q_CONCEPTS.findIndex(c => c.key.toLowerCase() === key);
  if (idxByKey >= 0) return idxByKey % windowSize;
  return 'today' as const;
}

function layoutBySize(size: Size) {
  switch (size) {
    case 'lg': return { cell: 18, gap: 3, pad: 12, cellH: 34, emojiFS: 13, captionFS: 13, legendFS: 12 };
    case 'md': return { cell: 14, gap: 2, pad: 10, cellH: 28, emojiFS: 11, captionFS: 12, legendFS: 11 };
    default:   return { cell: 12, gap: 2, pad: 8,  cellH: 24, emojiFS: 10, captionFS: 11, legendFS: 10 };
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
  const showCaption = searchParams.get('caption') === '1';    // show explainer under strip
  const showLegend  = searchParams.get('legend') === '1';     // show emoji→concept legend row
  const size = (searchParams.get('size') ?? 'md') as Size;    // sm|md|lg
  const wRaw = parseInt(searchParams.get('window') || '16', 10);
  const windowSize: WindowSize = (wRaw === 8 || wRaw === 16 || wRaw === 32) ? (wRaw as WindowSize) : 16;
  const focusParam = parseFocus(searchParams.get('focus'), windowSize);

  // Token: Authorization header > env (support Bearer|token)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  let headerToken: string | undefined;
  {
    const parts = authHeader.split(/\s+/);
    if (parts.length >= 2) {
      const scheme = parts[0]?.toLowerCase();
      if (scheme === 'bearer' || scheme === 'token') headerToken = parts[1]?.trim();
    }
  }
  const token = headerToken || process.env.GITHUB_TOKEN;

  // Pull contributions (prefer GraphQL calendar done in github helper)
  let counts: number[] = [];
  try {
    const daysBack = Math.max(60, windowSize);
    const weeks = await fetchContributionCalendar(username, token, daysBack);
    if (weeks) {
      const days = fromContributionCalendar(weeks);
      const minYMD = toYMD(new Date(Date.now() - daysBack * 86400000));
      const maxYMD = toYMD(new Date());
      const normalized = normalizeDays(days, minYMD, maxYMD);
      counts = normalized.slice(-windowSize).map(d => d.count || 0);
    } else {
      const events = await fetchEventsREST(username, token);
      const approx = fromEvents(events || [], windowSize);
      counts = approx.slice(-windowSize).map(d => d.count || 0);
    }
  } catch {
    counts = new Array(windowSize).fill(0);
  }

  // Normalize to 0..1 for intensity
  const maxC = Math.max(1, ...counts);
  const vals = counts.map(c => clamp01(c / maxC));

  // Layout
  const tc = themeColors(theme);
  const { cell, gap, pad, cellH, emojiFS, captionFS, legendFS } = layoutBySize(size);
  const legendH = showLegend ? (legendFS + 10) : 0;
  const captionH = showCaption ? (captionFS + 10) : 0;

  const width  = pad * 2 + windowSize * cell + (windowSize - 1) * gap;
  const height = pad * 2 + cellH + legendH + captionH;

  // Focus index (today = last cell)
  const focusIndex = ((): number => {
    if (focusParam === 'today') return windowSize - 1;
    if (typeof focusParam === 'number') return focusParam;
    return windowSize - 1;
  })();

  // Build day cells
  const cells: string[] = [];
  for (let i = 0; i < windowSize; i++) {
    const x = pad + i * (cell + gap);
    const y = pad;
    const v = vals[i];
    const c = counts[i];
    const concept = conceptForIndex(i);
    const fill = colorFor(v, theme);
    const isFocus = i === focusIndex;

    const label = `${concept.emoji} ${concept.title} — ${concept.hint} • ${c} contribution${c===1?'':'s'}`;
    const stroke = isFocus ? ` stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.2"` : '';
    const opacity = isFocus ? 1 : 0.92;

    cells.push(`
      <g>
        <title>${esc(label)}</title>
        <rect x="${x}" y="${y}" width="${cell}" height="${cellH}" rx="3" fill="${fill}" opacity="${opacity}"${stroke}/>
        <text x="${x + cell/2}" y="${y + cellH - 6}" text-anchor="middle"
              font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="${emojiFS}" fill="#ffffff" opacity="0.95">
          ${esc(concept.emoji)}
        </text>
      </g>
    `);
  }

  // Legend row (emoji + title list)
  let legend = '';
  if (showLegend) {
    const lx = pad;
    const ly = pad + cellH + (captionH > 0 ? captionH : 0) + (showCaption ? 6 : 0);
    const items = Q_CONCEPTS.slice(0, Math.min(Q_CONCEPTS.length, 8))
      .map(c => `${c.emoji} ${c.title}`).join('   •   ');
    legend = `
      <text x="${lx}" y="${ly}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
            font-size="${legendFS}" fill="#e5e7eb" opacity="0.95">
        ${esc(items)}
      </text>`;
  }

  // Caption under strip (focused concept)
  let caption = '';
  if (showCaption) {
    const fConcept = conceptForIndex(focusIndex);
    const text = `${fConcept.emoji} ${fConcept.title}: ${fConcept.hint}`;
    caption = `
      <text x="${pad}" y="${pad + cellH + captionFS}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
            font-size="${captionFS}" fill="#e5e7eb">${esc(text)}</text>`;
  }

  const shineHeight = pad * 2 + cellH;
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
  <rect width="${width}" height="${shineHeight}" fill="url(#shine)"/>
  ${cells.join('\n')}
  ${caption}
  ${legend}
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
