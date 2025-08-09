import { generateBadge } from './badge.js';
import { copyMarkdown } from './cache.js';

// Global state for rank and title
let currentRank = 'S++';
let currentTitle = 'Jedi';

export function setBadgeData(rank, title) {
    currentRank = rank;
    currentTitle = title;
}

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const shareBtn = document.getElementById('share-btn');

    if (!generateBtn || !copyBtn || !shareBtn) {
        console.error('Button elements not found');
        return;
    }

    generateBtn.addEventListener('click', generateBadge);
    copyBtn.addEventListener('click', copyMarkdown);
    shareBtn.addEventListener('click', () => {
        const shareText = `Check my Yoda-Level Badge! Rank: ${currentRank} ${currentTitle} 🚀 https://cosminmemetea.github.io/yoda-level-github-badge/ #GitHub #StarWars`;
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400');
    });
});