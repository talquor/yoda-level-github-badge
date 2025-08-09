import { textWidth } from './rank';

/** GitHub mark (kept as an option) */
const GH_LOGO_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38' +
  ' 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15' +
  ' -.72-.49.05-.48.05-.48.79.06 1.2.81 1.2.81.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06' +
  ' -2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32' +
  ' 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17' +
  ' .77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2' +
  ' 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z';

/** Minimal lightsaber */
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

/** Galaxy starburst sigil */
const GALAXY_SVG = `
  <g transform="translate(8,6)">
    <circle cx="6" cy="6" r="5.5" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
    <path d="M6 0 L6 12 M0 6 L12 6 M2.2 2.2 L9.8 9.8 M2.2 9.8 L9.8 2.2"
          stroke="#e5e7eb" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="6" cy="6" r="1.8" fill="#a7f3d0"/>
  </g>
`;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildBadgeSVG(opts: {
  label: string;
  rightText: string;        // e.g., "MASTER YODA (S++)"
  rightColor: string;       // hex
  leftColor?: string;       // sky-war slate
  icon?: 'github' | 'saber' | 'galaxy';
}) {
  const {
    label,
    rightText,
    rightColor,
    leftColor = '#141a2a',   // deeper space blue
    icon = 'saber'
  } = opts;

  const leftText = label.toUpperCase();
  const rightTextUpper = rightText.toUpperCase();

  // for-the-badge sizing
  const padX = 14;
  const height = 28;
  const radius = 4;

  const leftTextW  = textWidth(leftText, 'bold');
  const rightTextW = textWidth(rightTextUpper, 'bold');

  const hasIcon = icon === 'github' || icon === 'saber' || icon === 'galaxy';
  const leftW  = padX * 2 + leftTextW + (hasIcon ? 18 : 0);
  const rightW = padX * 2 + rightTextW;
  const totalW = leftW + rightW;

  let iconMarkup = '';
  if (icon === 'github') {
    iconMarkup = `<g transform="translate(8,6)"><path fill="#fff" d="${GH_LOGO_PATH}"/></g>`;
  } else if (icon === 'saber') {
    iconMarkup = SABER_SVG;
  } else if (icon === 'galaxy') {
    iconMarkup = GALAXY_SVG;
  }

  // subtle starfield on the left; glow on the right
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img" aria-label="${esc(leftText)}: ${esc(rightTextUpper)}">
  <title>${esc(leftText)}: ${esc(rightTextUpper)}</title>

  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".05"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.9">
      <stop offset="0" stop-color="${rightColor}" stop-opacity=".45"/>
      <stop offset=".6" stop-color="${rightColor}" stop-opacity=".15"/>
      <stop offset="1" stop-color="${rightColor}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="stars" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="2"  cy="3"  r=".6" fill="#9fb6ff" opacity=".45"/>
      <circle cx="7"  cy="1.5"r=".5" fill="#bcd1ff" opacity=".35"/>
      <circle cx="10" cy="7"  r=".7" fill="#e5e7eb" opacity=".4"/>
      <circle cx="4"  cy="9.5"r=".4" fill="#d1d5db" opacity=".35"/>
    </pattern>
    <mask id="round">
      <rect width="${totalW}" height="${height}" rx="${radius}" fill="#fff"/>
    </mask>
  </defs>

  <g mask="url(#round)">
    <!-- left space panel -->
    <rect width="${leftW}" height="${height}" fill="${leftColor}"/>
    <rect width="${leftW}" height="${height}" fill="url(#stars)" opacity=".35"/>
    <!-- right rank panel -->
    <rect x="${leftW}" width="${rightW}" height="${height}" fill="${rightColor}"/>
    <rect x="${leftW}" width="${rightW}" height="${height}" fill="url(#glow)"/>
    <!-- soft glossy overlay -->
    <rect width="${totalW}" height="${height}" fill="url(#g)"/>
  </g>

  <g aria-hidden="true" fill="#fff" text-rendering="geometricPrecision"
     font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    ${hasIcon ? iconMarkup : ''}
    <text x="${hasIcon ? 26 : 12}" y="19">${esc(leftText)}</text>
  </g>

  <g aria-hidden="true" fill="#fff" text-rendering="geometricPrecision"
     font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${leftW + padX}" y="19">${esc(rightTextUpper)}</text>
  </g>
</svg>`.trim();

  return { svg, width: totalW, height };
}
