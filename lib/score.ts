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

export const LEGEND_USERNAMES = new Set<string>(['torvalds']);

function maybeLegendBoostFromSignals(stars: number, followers: number) {
  return stars >= 50000 || followers >= 100000;
}

/** Return a float (1 decimal) for more granular progress. */
export function scoreFromGraphQL(m: GraphQLInputs): number {
  const stars = 25 * clamp01(Math.log10(1 + m.totalStars) / Math.log10(1 + 100000));
  const commits = 28 * clamp01(m.commits / 5000);
  const prs = 12 * clamp01(m.prContribs / 800);
  const issues = 8 * clamp01(m.issueContribs / 800);
  const reviews = 8 * clamp01(m.reviewContribs / 800);
  const repos = 5 * clamp01(m.repoContribs / 300);
  const followers = 8 * clamp01(Math.log10(1 + m.followers) / Math.log10(1 + 200000));

  let recency = 4;
  if (m.lastContributionAt) {
    const days = (Date.now() - new Date(m.lastContributionAt).getTime()) / 86400000;
    recency = 6 * clamp01((240 - days) / 240);
  }

  const total = stars + commits + prs + issues + reviews + repos + followers + recency;
  return Math.max(0, Math.min(100, Math.round(total * 10) / 10)); // keep 1 decimal
}

export function scoreFromREST(r: RestInputs): number {
  const now = Date.now();
  const totalStars = r.repos.reduce((s, x) => s + (x.stargazers_count || 0), 0);
  const starPts = 35 * clamp01(Math.log10(1 + totalStars) / Math.log10(1 + 100000));
  const forkSum = r.repos.reduce((s, x) => s + (x.forks_count || 0), 0);
  const forkPts = 10 * clamp01(Math.log10(1 + forkSum) / Math.log10(1 + 20000));
  const pushed90 = r.repos.filter(x => x.pushed_at && (now - new Date(x.pushed_at).getTime()) < 90*86400000).length;
  const pushPts = 18 * clamp01(pushed90 / 40);
  const langs = new Set(r.repos.map(x => (x.language || '').toLowerCase()).filter(Boolean));
  const langPts = 8 * clamp01(langs.size / 20);
  const followers = 12 * clamp01(Math.log10(1 + r.followers) / Math.log10(1 + 200000));
  const repoCount = 7 * clamp01(r.publicRepos / 120);
  const createdDays = (now - new Date(r.createdAt).getTime()) / 86400000;
  const agePts = 5 * clamp01((createdDays - 365) / (8 * 365));
  const recentEvents = r.events.filter(e => (now - new Date(e.created_at).getTime()) < 30*86400000).length;
  const eventPts = 5 * clamp01(recentEvents / 150);

  const total = starPts + forkPts + pushPts + langPts + followers + repoCount + agePts + eventPts;
  return Math.max(0, Math.min(100, Math.round(total * 10) / 10)); // 1 decimal
}

export function applyLegendOverride(username: string | null, points: number, approxStars?: number, approxFollowers?: number) {
  if (username && LEGEND_USERNAMES.has(username.toLowerCase())) return 100;
  if (maybeLegendBoostFromSignals(approxStars ?? 0, approxFollowers ?? 0)) return 100;
  return points;
}
