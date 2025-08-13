// Minimal GitHub fetch helpers for Edge runtime.
const REST = 'https://api.github.com';
const GQL = 'https://api.github.com/graphql';

function ghHeaders(token?: string, extra: Record<string, string> = {}) {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'yoda-level-github-badge',
    ...extra
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchUserREST(username: string, token?: string) {
  const r = await fetch(`${REST}/users/${encodeURIComponent(username)}`, {
    headers: ghHeaders(token),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`GitHub user not found (${r.status})`);
  return r.json();
}

export async function fetchReposREST(username: string, token?: string) {
  const perPage = 100;
  const url = `${REST}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&sort=updated&direction=desc`;
  const r = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
  if (!r.ok) throw new Error(`GitHub repos error (${r.status})`);
  return r.json(); // first 100 is enough for scoring
}

export async function fetchEventsREST(username: string, token?: string) {
  // Public events (last ~300). Good heuristic for recent activity.
  const r = await fetch(`${REST}/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
    headers: ghHeaders(token),
    cache: 'no-store'
  });
  if (!r.ok) return []; // events can be limited
  return r.json();
}

export type GraphQLMetrics = {
  followers: number;
  totalStars: number;
  lastContributionAt?: string | null;
  commits: number;
  prContribs: number;
  issueContribs: number;
  reviewContribs: number;
  repoContribs: number;
};

export async function fetchUserMetricsGraphQL(username: string, token?: string): Promise<GraphQLMetrics | null> {
  if (!token) return null;
  const q = `
    query($login: String!) {
      user(login: $login) {
        followers { totalCount }
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
          nodes { stargazerCount }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
          contributionCalendar {
            weeks {
              contributionDays { contributionCount date }
            }
          }
        }
      }
    }`;
  const r = await fetch(GQL, {
    method: 'POST',
    headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query: q, variables: { login: username } }),
    cache: 'no-store'
  });
  if (!r.ok) return null;
  const data = await r.json();
  const u = data?.data?.user;
  if (!u) return null;

  // lastContributionAt from most recent day with contributions
  let last: string | null = null;
  for (const w of u.contributionsCollection.contributionCalendar.weeks) {
    for (const d of w.contributionDays) {
      if (d.contributionCount > 0) last = d.date;
    }
  }
  const totalStars = (u.repositories.nodes as Array<{ stargazerCount: number }>)
    .reduce((s, n) => s + (n.stargazerCount || 0), 0);

  return {
    followers: u.followers.totalCount,
    totalStars,
    lastContributionAt: last,
    commits: u.contributionsCollection.totalCommitContributions,
    prContribs: u.contributionsCollection.totalPullRequestContributions,
    issueContribs: u.contributionsCollection.totalIssueContributions,
    reviewContribs: u.contributionsCollection.totalPullRequestReviewContributions,
    repoContribs: u.contributionsCollection.totalRepositoryContributions,
  };
}

// lib/github.ts 
/**
 * Fetch the GitHub contribution calendar (daily counts) for a user
 * for the past `daysBack` days (default 120).
 * Requires a GraphQL token in process.env.GITHUB_TOKEN (or passed in).
 */
export async function fetchContributionCalendar(username: string, token?: string, daysBack = 120) {
  const auth = token || process.env.GITHUB_TOKEN;
  if (!auth) return null; // no token → caller should fallback to REST events

  const dayMs = 86400000;
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * dayMs);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const resp = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: { login: username, from: from.toISOString(), to: to.toISOString() }
    })
  });

  if (!resp.ok) {
    // Swallow errors; caller will fallback
    return null;
  }
  const data = await resp.json();
  const weeks = data?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) return null;
  return weeks as Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>;
}
