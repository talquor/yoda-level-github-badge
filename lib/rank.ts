export type Tier = {
  name: string;   // persona label shown on the badge
  grade: string;  // rank code
  min: number;    // min points inclusive
  color: string;  // right-side color
};

/**
 * Sky-war flavored tier names all the way down.
 * You asked for Torvalds (best) to be Yoda → S++ label is "Master Yoda".
 */
export const TIERS: Tier[] = [
  { name: "Master Yoda",      grade: "S++", min: 98, color: "#22c55e" }, // emerald
  { name: "Grand Master",     grade: "S+",  min: 96, color: "#16a34a" },
  { name: "Jedi Master",      grade: "S",   min: 94, color: "#0ea5e9" }, // sky
  { name: "Jedi Council",     grade: "S-",  min: 92, color: "#3b82f6" }, // blue
  { name: "Sith Lord",        grade: "S--", min: 90, color: "#111827" }, // near-black

  { name: "Obi-Wan Kenobi",   grade: "A+",  min: 85, color: "#a3e635" }, // lime
  { name: "Jedi Knight",      grade: "A",   min: 80, color: "#22d3ee" }, // cyan

  { name: "Rebel Commander",  grade: "B+",  min: 75, color: "#a78bfa" }, // purple
  { name: "Rebel Pilot",      grade: "B",   min: 70, color: "#8b5cf6" },

  { name: "Padawan",          grade: "C+",  min: 65, color: "#9ca3af" }, // gray
  { name: "Youngling",        grade: "C",   min: 60, color: "#6b7280" },
  { name: "Academy Cadet",    grade: "C-",  min: 55, color: "#4b5563" },

  { name: "Frontier Scout",   grade: "D+",  min: 50, color: "#fb923c" }, // orange
  { name: "Cantina Regular",  grade: "D",   min: 45, color: "#f97316" },
  { name: "Scrapyard Tech",   grade: "D-",  min: 40, color: "#ea580c" },

  { name: "Moisture Farmer",  grade: "F+",  min: 30, color: "#ef4444" }, // red
  { name: "Force Beginner",   grade: "F",   min: 0,  color: "#dc2626" }
];

export function pickTierByPoints(points: number): Tier {
  const p = Math.max(0, Math.min(100, Math.floor(points)));
  for (const t of TIERS) if (p >= t.min) return t;
  return TIERS[TIERS.length - 1];
}

export function textWidth(txt: string, weight: "normal" | "bold" = "normal") {
  // simple width approximation tuned for for-the-badge caps
  const perChar = weight === "bold" ? 8.6 : 7.2;
  return Math.ceil(txt.length * perChar);
}
