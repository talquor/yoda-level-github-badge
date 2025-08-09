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
        const { rank, title, score } = cachedData;
        setBadgeData(rank, title);
        const badgeUrl = `https://img.shields.io/badge/Yoda%20Rank-${encodeURIComponent(`${rank} (${title})`)}-${getColorForRank(rank)}?logo=github&logoColor=white&style=for-the-badge`;
        markdownElement.value = `[![Yoda-Level Badge](${badgeUrl})](https://github.com/${encodeURIComponent(username)}) (Score: ${score.toFixed(2)})`;
        resultElement.classList.remove('hidden');
        return;
    }

    try {
        const repos = await fetchGitHubData(`https://api.github.com/users/${username}/repos?per_page=100`, token);
        if (!repos || repos.message === 'Not Found') throw new Error('User not found. Check username.');

        let totalCommits = 0, totalPRs = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const repo of repos) {
            let page = 1;
            while (true) {
                const commits = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/commits?since=${thirtyDaysAgo.toISOString()}&per_page=100&page=${page}`, token);
                if (!commits || commits.length === 0) break;
                totalCommits += commits.length;
                page++;
            }
            page = 1;
            while (true) {
                const prs = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/pulls?state=closed&since=${thirtyDaysAgo.toISOString()}&per_page=100&page=${page}`, token);
                if (!prs || prs.length === 0) break;
                totalPRs += prs.filter(pr => pr.user.login === username && pr.merged_at && new Date(pr.merged_at) >= thirtyDaysAgo).length;
                page++;
            }
        }

        // Linear scaling with higher weights for high activity
        const baseScore = (totalCommits * 2) + (totalPRs * 12);
        const score = Math.min(baseScore, 1000); // Cap at 1000 to prevent extreme values

        let rank, title;
        if (score >= 800) { rank = 'S++'; title = 'Jedi'; }
        else if (score >= 700) { rank = 'S+'; title = 'Master Yoda'; }
        else if (score >= 600) { rank = 'S'; title = 'Grand Master'; }
        else if (score >= 500) { rank = 'S-'; title = 'Jedi Master'; }
        else if (score >= 400) { rank = 'S--'; title = 'Darth Vader'; }
        else if (score >= 300) { rank = 'A+'; title = 'Obi-Wan Kenobi'; }
        else if (score >= 250) { rank = 'A'; title = 'Jedi Knight'; }
        else if (score >= 200) { rank = 'B+'; title = 'Luke Skywalker'; }
        else if (score >= 150) { rank = 'B'; title = 'Padawan'; }
        else if (score >= 100) { rank = 'C+'; title = 'Youngling'; }
        else if (score >= 75) { rank = 'C'; title = 'Initiate'; }
        else if (score >= 50) { rank = 'C-'; title = 'Force Apprentice'; }
        else if (score >= 30) { rank = 'D+'; title = 'Force Learner'; }
        else if (score >= 15) { rank = 'D'; title = 'Force Novice'; }
        else if (score >= 5) { rank = 'D-'; title = 'Force Newcomer'; }
        else if (score >= 1) { rank = 'F+'; title = 'Force Initiate'; }
        else { rank = 'F'; title = 'Force Beginner'; }

        setBadgeData(rank, title);
        const badgeUrl = `https://img.shields.io/badge/Yoda%20Rank-${encodeURIComponent(`${rank} (${title})`)}-${getColorForRank(rank)}?logo=github&logoColor=white&style=for-the-badge`;
        markdownElement.value = `[![Yoda-Level Badge](${badgeUrl})](https://github.com/${encodeURIComponent(username)}) (Score: ${score.toFixed(2)})`;
        resultElement.classList.remove('hidden');

        setCachedData(cacheKey, { rank, title, score });
    } catch (error) {
        setBadgeData('F', 'Force Beginner');
        const badgeUrl = `https://img.shields.io/badge/Yoda%20Rank-${encodeURIComponent('F (Force Beginner)')}-${getColorForRank('F')}?logo=github&logoColor=white&style=for-the-badge`;
        markdownElement.value = `[![Yoda-Level Badge](${badgeUrl})](https://github.com) (Score: 0)`;
        resultElement.classList.remove('hidden');
        alert(`Error fetching data: ${error.message}`);
        console.error(error);
    }
}

function getColorForRank(rank) {
    switch (rank) {
        case 'S++': return 'brightgreen';
        case 'S+': return 'green';
        case 'S': return 'lightgreen';
        case 'S-': return 'yellowgreen';
        case 'S--': return 'orange';
        case 'A+': return 'blue';
        case 'A': return 'lightblue';
        case 'B+': return 'yellow';
        case 'B': return 'gold';
        case 'C+': return 'lightgrey';
        case 'C': return 'grey';
        case 'C-': return 'darkgrey';
        case 'D+': return 'lightred';
        case 'D': return 'red';
        case 'D-': return 'darkred';
        case 'F+': return 'pink';
        case 'F': return 'lightpink';
        default: return 'grey';
    }
}