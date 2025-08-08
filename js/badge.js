import { fetchGitHubData } from './api.js';
import { getCachedData, setCachedData } from './cache.js';
import { setBadgeData } from './main.js';

export async function generateBadge() {
    const username = document.getElementById('username').value.trim();
    const token = document.getElementById('token').value.trim();
    const resultElement = document.getElementById('result');

    if (!resultElement) {
        alert('Internal error: Result area missing. Reload the page.');
        console.error('Result element not found');
        return;
    }

    // Validate username
    if (!username) {
        alert('Enter a GitHub username!');
        return;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(username)) {
        alert('Invalid username! Use letters, numbers, and hyphens.');
        return;
    }

    // Check cache
    const cacheKey = `badge_${username}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
        const { score, rank, title } = cachedData;
        setBadgeData(rank, title);
        const label = `Rank: ${rank} ${title}`;
        const badgeColor = rank === 'S++' || rank === 'S+' || rank === 'S' ? '#10B981' :
                          rank === 'S-' ? '#34D399' : rank === 'S--' ? '#6EE7B7' :
                          rank === 'A+' ? '#3B82F6' : rank === 'A' ? '#60A5FA' :
                          rank === 'B+' || rank === 'B' ? '#F59E0B' :
                          rank === 'C+' || rank === 'C' || rank === 'C-' ? '#FBBF24' :
                          rank === 'D+' || rank === 'D' || rank === 'D-' ? '#FCD34D' : '#FEF3C7';
        const badgeUrl = await renderBadge(label, badgeColor);
        const dynamicBadgeUrl = `https://<your-username>.github.io/yoda-level-github-badge/badge?user=${encodeURIComponent(username)}&rank=${encodeURIComponent(rank)}`;
        const markdown = `[![Yoda-Level Badge](${dynamicBadgeUrl})](https://github.com/${encodeURIComponent(username)})`;
        const markdownElement = document.getElementById('markdown');
        if (markdownElement) {
            markdownElement.value = markdown;
            resultElement.classList.remove('hidden');
        }
        return;
    }

    try {
        // Fetch GitHub data
        const repos = await fetchGitHubData(`https://api.github.com/users/${username}/repos`, token);
        if (!repos) throw new Error('User not found. Check username.');

        // Calculate GitHub Force Score
        let totalCommits = 0, totalPRs = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const repo of repos.slice(0, 5)) {
            const commits = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/commits?since=${thirtyDaysAgo.toISOString()}`, token);
            if (commits) totalCommits += commits.length;
            const prs = await fetchGitHubData(`https://api.github.com/repos/${username}/${repo.name}/pulls?state=closed&since=${thirtyDaysAgo.toISOString()}`, token);
            if (prs) totalPRs += prs.filter(pr => pr.user.login === username && new Date(pr.merged_at) >= thirtyDaysAgo).length;
        }

        // Score and rank
        const score = Math.min(Math.round(totalCommits * 0.6 + totalPRs * 4), 100);
        let rank, title, badgeColor;
        if (score >= 98) { rank = 'S++'; title = 'Supreme Yoda'; badgeColor = '#10B981'; }
        else if (score >= 95) { rank = 'S+'; title = 'Master Yoda'; badgeColor = '#10B981'; }
        else if (score >= 90) { rank = 'S'; title = 'Grand Master'; badgeColor = '#10B981'; }
        else if (score >= 85) { rank = 'S-'; title = 'Jedi Master'; badgeColor = '#34D399'; }
        else if (score >= 80) { rank = 'S--'; title = 'Darth Vader'; badgeColor = '#6EE7B7'; }
        else if (score >= 75) { rank = 'A+'; title = 'Obi-Wan Kenobi'; badgeColor = '#3B82F6'; }
        else if (score >= 70) { rank = 'A'; title = 'Jedi Knight'; badgeColor = '#60A5FA'; }
        else if (score >= 60) { rank = 'B+'; title = 'Luke Skywalker'; badgeColor = '#F59E0B'; }
        else if (score >= 50) { rank = 'B'; title = 'Padawan'; badgeColor = '#F59E0B'; }
        else if (score >= 40) { rank = 'C+'; title = 'Youngling'; badgeColor = '#FBBF24'; }
        else if (score >= 30) { rank = 'C'; title = 'Initiate'; badgeColor = '#FBBF24'; }
        else if (score >= 20) { rank = 'C-'; title = 'Force Apprentice'; badgeColor = '#FBBF24'; }
        else if (score >= 15) { rank = 'D+'; title = 'Force Learner'; badgeColor = '#FCD34D'; }
        else if (score >= 10) { rank = 'D'; title = 'Force Novice'; badgeColor = '#FCD34D'; }
        else if (score >= 5) { rank = 'D-'; title = 'Force Newcomer'; badgeColor = '#FCD34D'; }
        else if (score >= 2) { rank = 'F+'; title = 'Force Initiate'; badgeColor = '#FEF3C7'; }
        else { rank = 'F'; title = 'Force Beginner'; badgeColor = '#FEF3C7'; }

        setBadgeData(rank, title);
        const label = `Rank: ${rank} ${title}`;

        // Cache data
        setCachedData(cacheKey, { score, rank, title });

        // Render badge
        const badgeUrl = await renderBadge(label, badgeColor);

        // Generate Markdown
        const dynamicBadgeUrl = `https://<your-username>.github.io/yoda-level-github-badge/badge?user=${encodeURIComponent(username)}&rank=${encodeURIComponent(rank)}`;
        const markdown = `[![Yoda-Level Badge](${dynamicBadgeUrl})](https://github.com/${encodeURIComponent(username)})`;
        const markdownElement = document.getElementById('markdown');
        if (markdownElement) {
            markdownElement.value = markdown;
            resultElement.classList.remove('hidden');
        } else {
            alert('Error: Could not generate Markdown.');
            console.error('Markdown element not found');
        }
    } catch (error) {
        // Fallback badge for errors
        setBadgeData('F', 'Force Beginner');
        await renderBadge(`Error: ${error.message}`, '#EF4444');
        resultElement.classList.remove('hidden');
        alert(`Error fetching data: ${error.message}`);
    }
}

async function renderBadge(label, badgeColor) {
    const canvas = document.getElementById('staticCanvas');
    if (!canvas) {
        console.error('Static canvas element not found');
        return;
    }
    try {
        canvas.width = 200;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas context not supported');
        }

        // Background in shields.io style
        ctx.fillStyle = label.startsWith('Error') ? '#EF4444' : badgeColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(label, 10, 25);

        // GitHub text logo
        ctx.font = '10px monospace';
        ctx.fillText('GitHub', 170, 25);

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Canvas rendering error:', error);
        alert('Error rendering badge. Try a different browser.');
        return null;
    }
}