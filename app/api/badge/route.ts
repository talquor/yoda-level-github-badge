import { pickTierByPoints, tierWithBand } from '@/lib/rank';
import { buildBadgeSVG } from '@/lib/badge';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const label   = searchParams.get('label')   ?? 'Rank';
  const persona = searchParams.get('persona') ?? '';
  const grade   = searchParams.get('grade')   ?? '';
  const pointsQ = searchParams.get('points');
  const color   = searchParams.get('color')   ?? '';
  const logo    = (searchParams.get('logo') ?? 'saber') as 'github' | 'saber' | 'galaxy';
  const granular = searchParams.get('granular') === '1';
  const showPoints = searchParams.get('showPoints') === '1';
  const showNext = searchParams.get('showNext') === '1';

  let rightPersona = persona;
  let rightGrade   = grade;
  let rightColor   = color;
  let points: number | null = null;

  if (pointsQ !== null) {
    const p = Number(pointsQ);
    const t = pickTierByPoints(isNaN(p) ? 0 : p);
    rightPersona = t.name;
    rightGrade   = t.grade;
    rightColor   = t.color;
    points = isNaN(p) ? 0 : p;
  }

  rightPersona ||= 'Master Yoda';
  rightGrade   ||= 'S++';
  rightColor   ||= '#22c55e';

  let rightText = `${rightPersona} (${rightGrade})`;

  if (granular) {
    const p = points ?? (rightGrade === 'S++' ? 99 : 80);
    const { bandRoman, nextTier, pointsToNext } = tierWithBand(p);
    const parts = [`${rightPersona} (${rightGrade}) • ${bandRoman}`];
    if (showPoints) parts.push(`${p.toFixed(1)} pts`);
    if (showNext && nextTier && pointsToNext !== undefined) {
      parts.push(`+${pointsToNext.toFixed(1)} to ${nextTier.name}`);
    }
    rightText = parts.join(' • ');
  } else if (showPoints && points !== null) {
    rightText = `${rightText} • ${points.toFixed(1)} pts`;
  }

  const { svg } = buildBadgeSVG({
    label,
    rightText,
    rightColor,
    icon: logo
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate"
    }
  });
}
