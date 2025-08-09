import { generateBadge } from './badge.js';
import { copyMarkdown } from './cache.js';

// Global state for rank and title
let currentRank = 'S++'; // Default to S++ for demo
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
    shareBtn.addEventListener('click', async () => {
        const canvas = document.getElementById('staticCanvas');
        if (!canvas) return;
        const badgeColor = currentRank === 'S++' || currentRank === 'S+' || currentRank === 'S' ? '#10B981' :
                          currentRank === 'S-' ? '#34D399' : currentRank === 'S--' ? '#6EE7B7' :
                          currentRank === 'A+' ? '#3B82F6' : currentRank === 'A' ? '#60A5FA' :
                          currentRank === 'B+' || currentRank === 'B' ? '#F59E0B' :
                          currentRank === 'C+' || currentRank === 'C' || currentRank === 'C-' ? '#FBBF24' :
                          currentRank === 'D+' || currentRank === 'D' || currentRank === 'D-' ? '#FCD34D' : '#FEF3C7';

        try {
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: 200,
                height: 40
            });

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
                ctx.font = '10px monospace';
                ctx.fillText('GitHub', 170, 25);
                ctx.shadowColor = '#FFFFFF';
                ctx.shadowBlur = 5 + Math.sin(frame * 0.5) * 3;
                ctx.fillText('GitHub', 170, 25);
                ctx.shadowBlur = 0;
                gif.addFrame(frameCanvas, { delay: 200 });
            }

            await new Promise((resolve) => {
                gif.on('finished', (blob) => {
                    const url = URL.createObjectURL(blob);
                    const shareText = `Check my Yoda-Level Badge! Rank: ${currentRank} ${currentTitle} 🚀 https://cosminmemetea.github.io/yoda-level-github-badge/ #GitHub #StarWars`;
                    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                    window.open(shareUrl, '_blank', 'width=600,height=400');
                    resolve();
                });
                gif.render();
            });
        } catch (error) {
            console.error('GIF generation failed:', error);
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = badgeColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`Rank: ${currentRank} ${currentTitle}`, 10, 25);
            ctx.font = '10px monospace';
            ctx.fillText('GitHub', 170, 25);
            const url = canvas.toDataURL('image/png');
            const shareText = `Check my Yoda-Level Badge! Rank: ${currentRank} ${currentTitle} 🚀 https://cosminmemetea.github.io/yoda-level-github-badge/ #GitHub #StarWars`;
            const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    });
});

// Load GIF.js library
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
script.onload = () => console.log('GIF.js loaded');
document.head.appendChild(script);