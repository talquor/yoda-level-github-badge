export type Tier = {
  name: string;   // persona label
  grade: string;  // rank code
  min: number;    // min points inclusive
  color: string;  // right-side color
};

// Ranking system (top → bottom)
export const TIERS: Tier[] = [
  { name: "Jedi",           grade: "S++", min: 98, color: "#22c55e" }, // emerald
  { name: "Master Yoda",    grade: "S+",  min: 96, color: "#16a34a" },
  { name: "Grand Master",   grade: "S",   min: 94, color: "#0ea5e9" }, // sky
  { name: "Jedi Master",    grade: "S-",  min: 92, color: "#3b82f6" }, // blue
  { name: "Darth Vader",    grade: "S--", min: 90, color: "#111827" }, // near-black
  { name: "Obi-Wan Kenobi", grade: "A+",  min: 85, color: "#a3e635" }, // lime
  { name: "Jedi Knight",    grade: "A",   min: 80, color: "#22d3ee" }, // cyan
  { name: "Luke Skywalker", grade: "B+",  min: 75, color: "#a78bfa" }, // purple
  { name: "B-Class",        grade: "B",   min: 70, color: "#8b5cf6" },
  { name: "C+",             grade: "C+",  min: 65, color: "#9ca3af" }, // gray
  { name: "C-Class",        grade: "C",   min: 60, color: "#6b7280" },
  { name: "C-",             grade: "C-",  min: 55, color: "#4b5563" },
  { name: "D+",             grade: "D+",  min: 50, color: "#fb923c" }, // orange
  { name: "D-Class",        grade: "D",   min: 45, color: "#f97316" },
  { name: "D-",             grade: "D-",  min: 40, color: "#ea580c" },
  { name: "F+",             grade: "F+",  min: 30, color: "#ef4444" }, // red
  { name: "Force Beginner", grade: "F",   min: 0,  color: "#dc2626" }
];

export function pickTierByPoints(points: number): Tier {
  const p = Math.max(0, Math.min(100, Math.floor(points)));
  for (const t of TIERS) if (p >= t.min) return t;
  return TIERS[TIERS.length - 1];
}

export function textWidth(txt: string, weight: "normal" | "bold" = "normal") {
  // approximate width for “for-the-badge” caps
  const perChar = weight === "bold" ? 8.6 : 7.2;
  return Math.ceil(txt.length * perChar);
}

export const GH_LOGO_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38" +
  " 0-.19-.01-.82-.01-1.49C3.73 14.91 3.27 13.73 3.27 13.73c-.36-.91-.88-1.15-.88-1.15" +
  " -.72-.49.05-.48.05-.48.79.06 1.2.81 1.2.81.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06" +
  " -2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32" +
  " 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17" +
  " .77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2" +
  " 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z";
