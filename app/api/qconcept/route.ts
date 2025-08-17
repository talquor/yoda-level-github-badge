// app/api/qconcept/route.ts
import { themeColors, type Theme } from '@/lib/theme';
import { Q_CONCEPTS, conceptForIndex, indexForKey } from '@/lib/quantum_concepts';

export const runtime = 'edge';
type Size = 'sm' | 'md' | 'lg';

const esc = (s:string)=> (s||'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function layoutBySize(size: Size) {
  switch (size) {
    case 'lg': return { pad: 14, titleFS: 16, formulaFS: 13, hintFS: 13, lineW: 36, cardW: 560 };
    case 'md': return { pad: 12, titleFS: 14, formulaFS: 12, hintFS: 12, lineW: 34, cardW: 520 };
    default:   return { pad: 10, titleFS: 13, formulaFS: 11, hintFS: 11, lineW: 32, cardW: 480 };
  }
}
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const size  = (searchParams.get('size') ?? 'lg') as Size;
  const rotateMin = Math.max(1, Math.min(120, parseInt(searchParams.get('rotate') || '10', 10) || 10));
  const seed = searchParams.get('seed') || '';

  let idx: number | undefined;
  const cKey = searchParams.get('concept');
  const cIdx = searchParams.get('index');
  if (cKey) idx = indexForKey(cKey);
  else if (cIdx && !isNaN(+cIdx)) idx = (+cIdx) % Q_CONCEPTS.length;
  else {
    const nowMin = Math.floor(Date.now() / 60000);
    const base = Math.floor(nowMin / rotateMin);
    const shift = seed ? (hashStr(seed) % Q_CONCEPTS.length) : 0;
    idx = (base + shift) % Q_CONCEPTS.length;
  }
  if (idx! < 0) idx = 0;

  const tc = themeColors(theme);
  const concept = conceptForIndex(idx!);
  const { pad, titleFS, formulaFS, hintFS, lineW, cardW } = layoutBySize(size);

  const emojiX = pad + 8;
  const emojiY = pad + 24;
  const titleX = emojiX + 36;

  const titleText = `${concept.emoji}  ${concept.title}`;
  const formulaText = concept.formula;
  const hintAll = concept.more ? `${concept.hint} ${concept.more}` : concept.hint;

  const formulaLines = wrap(formulaText, lineW + 6, 2);
  const hintLines    = wrap(hintAll,    lineW + 10, 3);

  const tspans = (lines: string[], fs: number) =>
    lines.map((ln, i) => `<tspan x="${titleX}" dy="${i === 0 ? 0 : fs + 4}">${esc(ln)}</tspan>`).join('');

  const bgH = pad + 28 + (formulaLines.length * (formulaFS + 4)) + 8 + (hintLines.length * (hintFS + 4)) + pad;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${bgH}" role="img" aria-label="${esc(concept.title)} concept card">
  <title>${esc(concept.title)} — simple formula & intuition</title>
  <defs>
    <linearGradient id="shine" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${cardW}" height="${bgH}" rx="8" fill="${esc(tc.leftColor)}"/>
  <rect x="0" y="0" width="${cardW}" height="${bgH}" fill="url(#shine)"/>

  <text x="${titleX}" y="${emojiY}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="${titleFS}" font-weight="700" fill="#e5e7eb">${esc(titleText)}</text>

  <rect x="${titleX - 6}" y="${emojiY + 10}" width="${cardW - titleX - pad}" height="${formulaLines.length * (formulaFS + 4) + 10}"
        rx="6" fill="#000000" opacity="0.28"/>
  <text x="${titleX}" y="${emojiY + 26}" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="${formulaFS}" fill="#c7d2fe" opacity="0.98">${tspans(formulaLines, formulaFS)}</text>

  <rect x="${titleX - 6}" y="${emojiY + 20 + (formulaLines.length * (formulaFS + 4))}" width="${cardW - titleX - pad}"
        height="${hintLines.length * (hintFS + 4) + 12}" rx="6" fill="#000000" opacity="0.24"/>
  <text x="${titleX}" y="${emojiY + 36 + (formulaLines.length * (formulaFS + 4))}"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
        font-size="${hintFS}" fill="#e5e7eb" opacity="0.98">${tspans(hintLines, hintFS)}</text>

  <circle cx="${emojiX - 2}" cy="${emojiY - 6}" r="18" fill="#ffffff" opacity="0.08" stroke="#e5e7eb" stroke-opacity="0.22"/>
  <text x="${emojiX - 2}" y="${emojiY - 2}" text-anchor="middle"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="${titleFS + 6}" fill="#ffffff" opacity="0.95">
    ${esc(concept.emoji)}
  </text>

  <text x="${cardW - pad}" y="${bgH - 8}" text-anchor="end"
        font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="${hintFS - 1}" fill="#9ca3af">
    ${idx! + 1}/${Q_CONCEPTS.length}
  </text>
</svg>`.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=120, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Accept-Encoding'
    }
  });
}
