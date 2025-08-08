import { generateBadge } from './badge.js';
import { copyMarkdown } from './cache.js';

// Global state for rank and title
let currentRank = 'B';
let currentTitle = 'Padawan';

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
        const canvas = document.getElementById('staticCanvas');
        if (!canvas) return;
        const username = document.getElementById('username').value.trim();
        const badgeColor = currentRank === 'S++' || currentRank === 'S+' || currentRank === 'S' ? '#10B981' :
                          currentRank === 'S-' ? '#34D399' : currentRank === 'S--' ? '#6EE7B7' :
                          currentRank === 'A+' ? '#3B82F6' : currentRank === 'A' ? '#60A5FA' :
                          currentRank === 'B+' || currentRank === 'B' ? '#F59E0B' :
                          currentRank === 'C+' || currentRank === 'C' || currentRank === 'C-' ? '#FBBF24' :
                          currentRank === 'D+' || currentRank === 'D' || currentRank === 'D-' ? '#FCD34D' : '#FEF3C7';

        const frames = [];
        for (let frame = 0; frame < 5; frame++) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = 200;
            frameCanvas.height = 40;
            const ctx = frameCanvas.getContext('2d');
            ctx.fillStyle = badgeColor;
            ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`Rank: ${currentRank} ${currentTitle}`, 10, 25);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '10px monospace';
            ctx.fillText('GitHub', 170, 25);
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 5 + Math.sin(frame * 0.5) * 3;
            ctx.fillText('GitHub', 170, 25);
            ctx.shadowBlur = 0;
            frames.push(frameCanvas.toDataURL('image/png'));
        }

        const shareText = `My Yoda-Level GitHub Badge: ${currentRank} ${currentTitle}! 🚀 #GitHub #StarWars #OpenSource`;
        const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(frames[0])}`;
        window.open(shareUrl, '_blank');
    });
});