import { fetchGitHubData } from './api.js';
import { getCachedData, setCachedData } from './cache.js';
import { setBadgeData } from './main.js';

export async function generateBadge() {
    const username = document.getElementById('username')?.value?.trim() || '';
    const token = document.getElementById('token')?.value?.trim() || '';
    const resultElement = document.getElementById('result');
    const markdownElement = document.getElementById('markdown');

    if (!resultElement || !markdownElement) {
        alert('Internal error: UI elements missing. Reload the page.');
        console.error('Result or Markdown element not found');
        return;
    }

    if (!username) {
        alert('Enter a GitHub username!');
        return;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(username)) {
        alert('Invalid username! Use letters, numbers, and hyphens.');
        return;
    }

    const cacheKey = `badge_${username}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
        const { rank, title } = cachedData;
        setBadgeData(rank, title);
        const badgeUrl = `https://yoda-level-github-badge-api.vercel.app/api/badge?user=${encodeURIComponent(username)}&rank=${encodeURIComponent(rank)}`;
        markdownElement.value = `[![Yoda-Level Badge](${badgeUrl})](https://github.com/${encodeURIComponent(username)})`;
        resultElement.classList.remove('hidden');
        return;
    }

    try {
        const repos = await fetchGitHubData(`https://api.github.com/users/${username}/repos`, token);
        if (!repos || repos.message === 'Not Found') throw new Error('User not found. Check username.');

        let totalCommits = 0, totalPRs = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const repo of repos.slice(0, 5)) {
            const commits = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/commits?since=${thirtyDaysAgo.toISOString()}`, token);
            if (commits) totalCommits += commits.length;
            const prs = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/pulls?state=closed&since=${thirtyDaysAgo.toISOString()}`, token);
            if (prs) totalPRs += prs.filter(pr => pr.user.login === username && pr.merged_at && new Date(pr.merged_at) >= thirtyDaysAgo).length;
        }

        const score = Math.min(Math.round(totalCommits * 0.6 + totalPRs * 4), 100);
        let rank, title;
        if (score >= 98) { rank = 'S++'; title = 'Jedi'; }
        else if (score >= 95) { rank = 'S+'; title = 'Master Yoda'; }
        else if (score >= 90) { rank = 'S'; title = 'Grand Master'; }
        else if (score >= 85) { rank = 'S-'; title = 'Jedi Master'; }
        else if (score >= 80) { rank = 'S--'; title = 'Darth Vader'; }
        else if (score >= 75) { rank = 'A+'; title = 'Obi-Wan Kenobi'; }
        else if (score >= 70) { rank = 'A'; title = 'Jedi Knight'; }
        else if (score >= 60) { rank = 'B+'; title = 'Luke Skywalker'; }
        else if (score >= 50) { rank = 'B'; title = 'Padawan'; }
        else if (score >= 40) { rank = 'C+'; title = 'Youngling'; }
        else if (score >= 30) { rank = 'C'; title = 'Initiate'; }
        else if (score >= 20) { rank = 'C-'; title = 'Force Apprentice'; }
        else if (score >= 15) { rank = 'D+'; title = 'Force Learner'; }
        else if (score >= 10) { rank = 'D'; title = 'Force Novice'; }
        else if (score >= 5) { rank = 'D-'; title = 'Force Newcomer'; }
        else if (score >= 2) { rank = 'F+'; title = 'Force Initiate'; }
        else { rank = 'F'; title = 'Force Beginner'; }

        setBadgeData(rank, title);
        const badgeUrl = `https://yoda-level-github-badge-api.vercel.app/api/badge?user=${encodeURIComponent(username)}&rank=${encodeURIComponent(rank)}`;
        markdownElement.value = `[![Yoda-Level Badge](${badgeUrl})](https://github.com/${encodeURIComponent(username)})`;
        resultElement.classList.remove('hidden');

        setCachedData(cacheKey, { rank, title });
    } catch (error) {
        setBadgeData('F', 'Force Beginner');
        markdownElement.value = `[![Yoda-Level Badge](https://yoda-level-github-badge-api.vercel.app/api/badge?user=invalid&rank=F)](https://github.com)`;
        resultElement.classList.remove('hidden');
        alert(`Error fetching data: ${error.message}`);
        console.error(error);
    }
}