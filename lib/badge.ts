import { textWidth } from './rank';

export function buildBadgeSVG(opts: {
  label: string;
  rightText: string;        // e.g., "JEDI (S++)"
  rightColor: string;       // hex
  withGithubLogo?: boolean; // GH logo on left segment
  leftColor?: string;       // defaults to dark slate
}) {
  const {
    label,
    rightText,
    rightColor,
    withGithubLogo = false,
    leftColor = '#2e3440',
  } = opts;

  const leftText = label.toUpperCase();
  const rightTextUpper = rightText.toUpperCase();

  const padX = 14;
  const height = 28;
  const radius = 4;

  const leftTextW = textWidth(leftText, 'bold');
  const rightTextW = textWidth(rightTextUpper, 'bold');

  const leftW = padX * 2 + leftTextW + (withGithubLogo ? 18 : 0);
  const rightW = padX * 2 + rightTextW;
  const totalW = leftW + rightW;

  const GH_LOGO_PATH =
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38' +
    ' 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15' +
    ' -.72-.49.05-.48.05-.48.79.06 1.2.81 1.2.81.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06' +
    ' -2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32' +
    ' 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17' +
    ' .77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2' +
    ' 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z';

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img" aria-label="${esc(
    leftText,
  )}: ${esc(rightTextUpper)}">
  <title>${esc(leftText)}: ${esc(rightTextUpper)}</title>
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".05"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="round">
    <rect width="${totalW}" height="${height}" rx="${radius}" fill="#fff"/>
  </mask>

  <g mask="url(#round)">
    <rect width="${leftW}" height="${height}" fill="${leftColor}"/>
    <rect x="${leftW}" width="${rightW}" height="${height}" fill="${rightColor}"/>
    <rect width="${totalW}" height="${height}" fill="url(#g)"/>
  </g>

  <g aria-hidden="true" fill="#fff" text-rendering="geometricPrecision"
     font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    ${withGithubLogo ? `<g transform="translate(8,6)"><path fill="#fff" d="${GH_LOGO_PATH}"/></g>` : ``}
    <text x="${withGithubLogo ? 26 : 12}" y="19">${esc(leftText)}</text>
  </g>

  <g aria-hidden="true" fill="#fff" text-rendering="geometricPrecision"
     font-family="Verdana, DejaVu Sans, Geneva, sans-serif" font-size="12" font-weight="700">
    <text x="${leftW + padX}" y="19">${esc(rightTextUpper)}</text>
  </g>
</svg>`.trim();

  return { svg, width: totalW, height };
}
