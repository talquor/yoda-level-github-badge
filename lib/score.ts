// Converts GitHub history → 0..100 points.
// Enhanced to (a) saturate for mega-accounts and (b) allow legend overrides.

export type RestInputs = {
  followers: number;
  publicRepos: number;
  createdAt: string;
  repos: Array<{
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    pushed_at: string | null;
    updated_at: string | null;
  }>;
  events: Array<{ type: string; created_at: string }>;
};

export type GraphQLInputs = {
  followers: number;
  totalStars: number;
  lastContributionAt?: string | null;
  commits: number;
  prContribs: number;
  issueContribs: number;
  reviewContribs: number;
  repoContribs: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** If user is in this list, they are auto-promoted to 100 (Master Yoda). */
export const LEGEND_USERNAMES = new Set<string>([
  'torvalds',                 // you asked specifically
  // add others if you want later
]);

/** If signals are astronomically high, also cap to 100. */
function maybeLegendBoostFromSignals(stars: number, followers: number) {
  // Mega stars OR mega followers → legend
  return stars >= 50000 || followers >= 100000;
}

export function scoreFromGraphQL(m: GraphQLInputs): number {
  // Heavier caps so top accounts saturate near 100.
  const stars = 25 * clamp01(Math.log10(1 + m.totalStars) / Math.log10(1 + 100000)); // 0..25
  const commits = 28 * clamp01(m.commits / 5000);                                     // 0..28
  const prs = 12 * clamp01(m.prContribs / 800);                                       // 0..12
  const issues = 8 * clamp01(m.issueContribs / 800);                                  // 0..8
  const reviews = 8 * clamp01(m.reviewContribs / 800);                                // 0..8
  const repos = 5 * clamp01(m.repoContribs / 300);                                    // 0..5
  const followers = 8 * clamp01(Math.log10(1 + m.followers) / Math.log10(1 + 200000));// 0..8

  let recency = 4; // base
  if (m.lastContributionAt) {
    const days = (Date.now() - new Date(m.lastContributionAt).getTime()) / 86400000;
    recency = 6 * clamp01((240 - days) / 240); // active within 8 months => up to +6
  }

  let total = stars + commits + prs + issues + reviews + repos + followers + recency;

  // Soft ceiling at 100
  total = Math.min(100, Math.round(total));
  return total;
}

export function scoreFromREST(r: RestInputs): number {
  const now = Date.now();
  const totalStars = r.repos.reduce((s, x) => s + (x.stargazers_count || 0), 0);
  const starPts = 35 * clamp01(Math.log10(1 + totalStars) / Math.log10(1 + 100000)); // 0..35 (more weight)

  const forkSum = r.repos.reduce((s, x) => s + (x.forks_count || 0), 0);
  const forkPts = 10 * clamp01(Math.log10(1 + forkSum) / Math.log10(1 + 20000));

  const pushed90 = r.repos.filter(x => x.pushed_at && (now - new Date(x.pushed_at).getTime()) < 90*86400000).length;
  const pushPts = 18 * clamp01(pushed90 / 40);

  const langs = new Set(r.repos.map(x => (x.language || '').toLowerCase()).filter(Boolean));
  const langPts = 8 * clamp01(langs.size / 20);

  const followers = 12 * clamp01(Math.log10(1 + r.followers) / Math.log10(1 + 200000));

  const repoCount = 7 * clamp01(r.publicRepos / 120);

  const createdDays = (now - new Date(r.createdAt).getTime()) / 86400000;
  const agePts = 5 * clamp01((createdDays - 365) / (8 * 365)); // full after ~9 years

  const recentEvents = r.events.filter(e => (now - new Date(e.created_at).getTime()) < 30*86400000).length;
  const eventPts = 5 * clamp01(recentEvents / 150);

  let total = starPts + forkPts + pushPts + langPts + followers + repoCount + agePts + eventPts;

  // Soft ceiling
  total = Math.min(100, Math.round(total));
  return total;
}

/** Final step allowing username-based or signal-based Yoda promotion. */
export function applyLegendOverride(username: string | null, points: number, approxStars?: number, approxFollowers?: number) {
  if (username && LEGEND_USERNAMES.has(username.toLowerCase())) return 100;
  if (maybeLegendBoostFromSignals(approxStars ?? 0, approxFollowers ?? 0)) return 100;
  return points;
}
