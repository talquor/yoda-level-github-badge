// Converts GitHub history → 0..100 points.
// If GraphQL metrics are available (token set), we use richer signals.
// Otherwise we use REST-based heuristics.

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

export function scoreFromGraphQL(m: GraphQLInputs): number {
  // Weights sum to 100
  const stars = 20 * clamp01(Math.log10(1 + m.totalStars) / Math.log10(1 + 5000)); // 0..20
  const commits = 30 * clamp01(m.commits / 3000);                                   // 0..30
  const prs = 15 * clamp01(m.prContribs / 300);                                     // 0..15
  const issues = 10 * clamp01(m.issueContribs / 300);                               // 0..10
  const reviews = 10 * clamp01(m.reviewContribs / 300);                             // 0..10
  const repos = 5 * clamp01(m.repoContribs / 200);                                  // 0..5
  const followers = 8 * clamp01(Math.log10(1 + m.followers) / Math.log10(1 + 1000)); // 0..8

  let recency = 2; // base
  if (m.lastContributionAt) {
    const days = (Date.now() - new Date(m.lastContributionAt).getTime()) / 86400000;
    recency = 5 * clamp01((180 - days) / 180); // active within 6 months => up to +5
  }

  const total = stars + commits + prs + issues + reviews + repos + followers + recency;
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function scoreFromREST(r: RestInputs): number {
  const now = Date.now();

  const totalStars = r.repos.reduce((s, x) => s + (x.stargazers_count || 0), 0);
  const starPts = 30 * clamp01(Math.log10(1 + totalStars) / Math.log10(1 + 3000)); // 0..30

  const forkSum = r.repos.reduce((s, x) => s + (x.forks_count || 0), 0);
  const forkPts = 10 * clamp01(Math.log10(1 + forkSum) / Math.log10(1 + 1000));    // 0..10

  const pushed90 = r.repos.filter(x => x.pushed_at && (now - new Date(x.pushed_at).getTime()) < 90*86400000).length;
  const pushPts = 20 * clamp01(pushed90 / 25);                                      // 0..20

  const langs = new Set(r.repos.map(x => (x.language || '').toLowerCase()).filter(Boolean));
  const langPts = 10 * clamp01(langs.size / 12);                                    // 0..10

  const followers = 10 * clamp01(Math.log10(1 + r.followers) / Math.log10(1 + 1000)); // 0..10

  const repoCount = 8 * clamp01(r.publicRepos / 60);                                // 0..8

  const createdDays = (now - new Date(r.createdAt).getTime()) / 86400000;
  const agePts = 5 * clamp01((createdDays - 365) / (4 * 365));                      // 0..5 (full after ~5 years)

  // Recent public events in last 30 days
  const recentEvents = r.events.filter(e => (now - new Date(e.created_at).getTime()) < 30*86400000).length;
  const eventPts = 7 * clamp01(recentEvents / 100);                                  // 0..7

  const total = starPts + forkPts + pushPts + langPts + followers + repoCount + agePts + eventPts;
  return Math.max(0, Math.min(100, Math.round(total)));
}
