// app/api/qrotator/route.ts
import { themeColors, type Theme } from '@/lib/theme';
import { Q_CONCEPTS, conceptForIndex, indexForKey } from '@/lib/quantum_concepts';

export const runtime = 'edge';

type Size = 'sm' | 'md' | 'lg';

const esc = (s:string)=> (s||'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function layoutBySize(size: Size) {
  switch (size) {
    case 'lg': return { pad: 14, titleFS: 16, formulaFS: 13, hintFS: 13, lineW: 36, cardW: 560, emojiR: 18 };
    case 'md': return { pad: 12, titleFS: 14, formulaFS: 12, hintFS: 12, lineW: 34, cardW: 520, emojiR: 16 };
    default:   return { pad: 10, titleFS: 13, formulaFS: 11, hintFS: 11, lineW: 32, cardW: 480, emojiR: 15 };
  }
}

/** Split into tspans by max chars so text always visible in README */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = []; let cur: string[] = [];
  for (const w of words) {
    const next = [...cur, w].join(' ');
    if (next.length <= maxChars) cur.push(w);
    else { if (cur.length) lines.push(cur.join(' ')); cur = [w]; if (lines.length >= maxLines - 1) break; }
  }
  if (cur.length && lines.length < maxLines) lines.push(cur.join(' '));
  return lines;
}

/** Build one non-animated frame <g> (we’ll animate opacity per-frame) */
function frameGroup(opts: {
  idx: number;
  themeColors: { leftColor: string };
  pad: number; titleFS: number; formulaFS: number; hintFS: number; lineW: number; cardW: number; emojiR: number;
  wrapText: boolean;
}) {
  const { idx, pad, titleFS, formulaFS, hintFS, lineW, cardW, emojiR, wrapText } = opts;
  const c = conceptForIndex(idx);

  const emojiX = pad + 8;
  const emojiY = pad + 24;
  const titleX = emojiX + 36;

  const titleText   = `${c.emoji}  ${c.title}`;
  const formulaText = c.formula;
  const hintAll     = c.more ? `${c.hint} ${c.more}` : c.hint;

  const formulaLines = wrapText ? wrap(formulaText, lineW + 6, 2) : [formulaText];
  const hintLines    = wrapText ? wrap(hintAll,    lineW + 10, 3) : [hintAll];

  const tspans = (lines: string[], fs: number, x: number) =>
    lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : fs + 4}">${esc(ln)}</tspan>`).join('');

  const panelW = cardW - titleX - pad;
  const formulaH = formulaLines.length * (formulaFS + 4) + 10;
  const hintH    = hintLines.length * (hintFS + 4) + 12;

  const g = `
    <g id="frame-${idx}" opacity="0">
      <!-- Title -->
      <text x="${titleX}" y="${emojiY}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
            font-size="${titleFS}" font-weight="700" fill="#e5e7eb">${esc(titleText)}</text>

      <!-- Formula panel -->
      <rect x="${titleX - 6}" y="${emojiY + 10}" width="${panelW}" height="${formulaH}"
            rx="6" fill="#000000" opacity="0.28"/>
      <text x="${titleX}" y="${emojiY + 26}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
            font-size="${formulaFS}" fill="#c7d2fe" opacity="0.98">
        ${tspans(formulaLines, formulaFS, titleX)}
      </text>

      <!-- Hint panel -->
      <rect x="${titleX - 6}" y="${emojiY + 20 + (formulaLines.length * (formulaFS + 4))}"
            width="${panelW}" height="${hintH}" rx="6" fill="#000000" opacity="0.24"/>
      <text x="${titleX}" y="${emojiY + 36 + (formulaLines.length * (formulaFS + 4))}"
            font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
            font-size="${hintFS}" fill="#e5e7eb" opacity="0.98">
        ${tspans(hintLines, hintFS, titleX)}
      </text>

      <!-- Big emoji badge -->
      <circle cx="${emojiX - 2}" cy="${emojiY - 6}" r="${emojiR}" fill="#ffffff" opacity="0.08"
              stroke="#e5e7eb" stroke-opacity="0.22"/>
      <text x="${emojiX - 2}" y="${emojiY - 2}" text-anchor="middle"
            font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="${titleFS + 6}" fill="#ffffff" opacity="0.95">
        ${esc(c.emoji)}
      </text>

      <!-- Footer index -->
      <text x="${cardW - pad}" y="${pad + 28 + formulaH + 8 + hintH + pad - 8}" text-anchor="end"
            font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="${hintFS - 1}" fill="#9ca3af">
        ${idx + 1}/${Q_CONCEPTS.length}
      </text>
    </g>
  `;
  const groupHeight = pad + 28 + formulaH + 8 + hintH + pad; // used for the whole SVG height
  return { g, height: groupHeight };
}

/** Build SMIL opacity animations so each frame is visible for 'dur' seconds in turn */
function animateOpacity(n: number, durPer: number) {
  const total = n * durPer;
  // For each frame k, opacity is 1 during its slot, 0 otherwise.
  // Use keyTimes + values to produce a "step" function.
  const pieces: string[] = [];
  for (let k = 0; k < n; k++) {
    const start = (k * durPer) / total;
    const end   = ((k + 1) * durPer) / total;
    const keyTimes = `0; ${start}; ${end}; 1`;
    const values   = `0; 1; 0; 0`;
    pieces.push(`
      <animate attributeName="opacity"
               dur="${total}s"
               repeatCount="indefinite"
               calcMode="discrete"
               keyTimes="${keyTimes}"
               values="${values}" />
    `);
  }
  return (idx: number) => pieces[idx];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const size  = (searchParams.get('size') ?? 'lg') as Size;
  const dur   = Math.max(2, Math.min(20, parseInt(searchParams.get('dur') || '4', 10) || 4)); // seconds per frame
  const wrapText = searchParams.get('wrap') !== '0';

  // Optional static frame override
  let staticIdx: number | undefined;
  const frameQ = searchParams.get('frame');
  if (frameQ) {
    const n = Number(frameQ);
    if (!Number.isNaN(n)) staticIdx = ((n % Q_CONCEPTS.length) + Q_CONCEPTS.length) % Q_CONCEPTS.length;
    else staticIdx = indexForKey(frameQ);
  }

  const tc = themeColors(theme);
  const L = Q_CONCEPTS.length;
  const { pad, titleFS, formulaFS, hintFS, lineW, cardW, emojiR } = layoutBySize(size);

  // Build all frames once (same layout, different content)
  const frames = Array.from({ length: L }, (_, i) =>
    frameGroup({ idx: i, themeColors: tc, pad, titleFS, formulaFS, hintFS, lineW, cardW, emojiR, wrapText })
  );
  const height = Math.max(...frames.map(f => f.height));

  // If static frame requested, render only that group (no animation)
  if (typeof staticIdx === 'number') {
    const f = frames[staticIdx];
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${height}" role="img"
     aria-label="${esc(Q_CONCEPTS[staticIdx].title)} concept card">
  <title>${esc(Q_CONCEPTS[staticIdx].title)} — simple formula & intuition</title>
  <defs>
    <linearGradient id="shine" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${cardW}" height="${height}" rx="8" fill="${esc(tc.leftColor)}"/>
  <rect x="0" y="0" width="${cardW}" height="${height}" fill="url(#shine)"/>
  ${f.g.replace('opacity="0"', 'opacity="1"')}
</svg>`.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Animated version
  const animFor = animateOpacity(L, dur);
  const groups = frames.map((f, i) => f.g.replace('</g>', `${animFor(i)}</g>`)).join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${height}" role="img"
     aria-label="Quantum concepts rotator">
  <title>Quantum Concepts — animated rotator</title>
  <defs>
    <linearGradient id="shine" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${cardW}" height="${height}" rx="8" fill="${esc(tc.leftColor)}"/>
  <rect x="0" y="0" width="${cardW}" height="${height}" fill="url(#shine)"/>

  ${groups}
</svg>`.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // modest cache so camo refreshes periodically but doesn't hammer your server
      'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
