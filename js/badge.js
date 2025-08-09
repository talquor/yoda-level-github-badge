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
            const commits = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/commits?since=${thirtyDaysAgo.toISOString()}&per_page=100`, token);
            if (commits) totalCommits += commits.length;
            const prs = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/pulls?state=closed&since=${thirtyDaysAgo.toISOString()}&per_page=100`, token);
            if (prs) totalPRs += prs.filter(pr => pr.user.login === username && pr.merged_at && new Date(pr.merged_at) >= thirtyDaysAgo).length;
        }

        const baseScore = totalCommits * 0.8 + totalPRs * 8;
        const score = Math.log10(baseScore + 1) * 100;

        let rank, title;
        if (score >= 200) { rank = 'S++'; title = 'Jedi'; }
        else if (score >= 180) { rank = 'S+'; title = 'Master Yoda'; }
        else if (score >= 160) { rank = 'S'; title = 'Grand Master'; }
        else if (score >= 140) { rank = 'S-'; title = 'Jedi Master'; }
        else if (score >= 120) { rank = 'S--'; title = 'Darth Vader'; }
        else if (score >= 100) { rank = 'A+'; title = 'Obi-Wan Kenobi'; }
        else if (score >= 80) { rank = 'A'; title = 'Jedi Knight'; }
        else if (score >= 60) { rank = 'B+'; title = 'Luke Skywalker'; }
        else if (score >= 40) { rank = 'B'; title = 'Padawan'; }
        else if (score >= 30) { rank = 'C+'; title = 'Youngling'; }
        else if (score >= 20) { rank = 'C'; title = 'Initiate'; }
        else if (score >= 15) { rank = 'C-'; title = 'Force Apprentice'; }
        else if (score >= 10) { rank = 'D+'; title = 'Force Learner'; }
        else if (score >= 5) { rank = 'D'; title = 'Force Novice'; }
        else if (score >= 2) { rank = 'D-'; title = 'Force Newcomer'; }
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