// app/api/qrotator-mini/route.ts
import { themeColors, type Theme } from '@/lib/theme';
import { Q_CONCEPTS, conceptForIndex, indexForKey } from '@/lib/quantum_concepts';
import { textWidth } from '@/lib/rank';

export const runtime = 'edge';

const esc = (s:string)=> (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

type Icon = 'github' | 'saber' | 'galaxy' | 'none';

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
    <rect x="10" y="7" width="6" height="4" rx="1.2" fill="#34d399" />
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const theme = (searchParams.get('theme') ?? 'jedi') as Theme;
  const tc = themeColors(theme);

  const dur = Math.max(2, Math.min(20, parseInt(searchParams.get('dur') || '4', 10) || 4));
  const label = (searchParams.get('label') ?? 'Quantum').toUpperCase();
  const icon = (searchParams.get('icon') ?? 'galaxy') as Icon;
  const pad = Math.max(10, Math.min(20, parseInt(searchParams.get('pad') || '14', 10) || 14));

  // Optional: static frame instead of animation
  let staticIdx: number | undefined;
  const frameQ = searchParams.get('frame');
  if (frameQ) {
    const n = Number(frameQ);
    if (!Number.isNaN(n)) staticIdx = ((n % Q_CONCEPTS.length) + Q_CONCEPTS.length) % Q_CONCEPTS.length;
    else staticIdx = indexForKey(frameQ);
  }

  const height = 28;
  const radius = 4;

  const hasIcon = icon !== 'none';
  const leftTextW = textWidth(label, 'bold');
  const leftW = pad * 2 + leftTextW + (hasIcon ? 18 : 0);

  // Build right texts (emoji + title) uppercased
  const rightTexts = Q_CONCEPTS.map(c => `${c.emoji} ${c.title.toUpperCase()}`);
  const rightW = pad * 2 + Math.max(...rightTexts.map(t => textWidth(t, 'bold')));

  const totalW = leftW + rightW;

  // Build right-side frames
  const frameGs: string[] = rightTexts.map((txt, i) => {
    return `
      <g id="rt-${i}" opacity="0">
        <text x="${leftW + pad}" y="19" font-family="Verdana, DejaVu Sans, Geneva, sans-serif"
              font-size="12" font-weight="700" fill="#ffffff">${esc(txt)}</text>
      </g>
    `;
  });

  // Build SMIL opacity animations for each right frame
  const L = rightTexts.length;
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

  // Left icon + label
  const leftIcon = iconMarkup(icon);
  const leftTextX = hasIcon ? 26 : 12;

  // Static version (if frame=… is supplied)
  if (typeof staticIdx === 'number') {
    const svgStatic = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img"
     aria-label="${esc(label)}: ${esc(rightTexts[staticIdx])}">
  <title>${esc(label)}: ${esc(rightTexts[staticIdx])}</title>
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
  </g>

  ${hasIcon ? leftIcon : ''}

  <g fill="#ffffff" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${leftTextX}" y="19">${esc(label)}</text>
    <text x="${leftW + pad}" y="19">${esc(rightTexts[staticIdx])}</text>
  </g>
</svg>`.trim();

    return new Response(svgStatic, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Animated version
  const groups = frameGs.map((g, i) => g.replace('</g>', `${animFor(i)}</g>`)).join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img"
     aria-label="${esc(label)}: rotating quantum concepts">
  <title>${esc(label)}: rotating quantum concepts</title>
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
  </g>

  ${hasIcon ? leftIcon : ''}

  <g fill="#ffffff" font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${leftTextX}" y="19">${esc(label)}</text>
  </g>

  ${groups}
</svg>`.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
