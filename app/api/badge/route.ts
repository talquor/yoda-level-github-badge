// app/api/badge/route.ts
import { pickTierByPoints } from '@/lib/rank';
import { buildBadgeSVG } from '@/lib/badge';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const label   = searchParams.get('label')   ?? 'Yoda Rank';
  const persona = searchParams.get('persona') ?? '';
  const grade   = searchParams.get('grade')   ?? '';
  const pointsQ = searchParams.get('points');
  const color   = searchParams.get('color')   ?? '';
  const logo    = (searchParams.get('logo') ?? 'saber') as 'github' | 'saber' | 'galaxy';

  let rightPersona = persona;
  let rightGrade   = grade;
  let rightColor   = color;

  if (pointsQ !== null) {
    const p = Number(pointsQ);
    const t = pickTierByPoints(isNaN(p) ? 0 : p);
    rightPersona = t.name;
    rightGrade   = t.grade;
    rightColor   = t.color;
  }

  rightPersona ||= 'Master Yoda';
  rightGrade   ||= 'S++';
  rightColor   ||= '#22c55e';

  const rightText = `${rightPersona} (${rightGrade})`;

  const { svg } = buildBadgeSVG({
    label,
    rightText,
    rightColor,
    icon: logo
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, must-revalidate'
    }
  });
}
