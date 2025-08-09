export function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 3600000) return data; // 1-hour cache
        localStorage.removeItem(key);
    }
    return null;
}

export function setCachedData(key, data) {
    localStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }));
}

export function clearOldCache() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('badge_')) {
            const data = JSON.parse(localStorage.getItem(key));
            if (Date.now() - data.timestamp >= 3600000) localStorage.removeItem(key);
        }
    }
}

export function copyMarkdown() {
    const markdown = document.getElementById('markdown');
    if (markdown) {
        markdown.select();
        document.execCommand('copy');
        alert('Markdown copied to clipboard!');
    } else {
        alert('Error: Could not copy Markdown.');
        console.error('Markdown element not found');
    }
}

document.addEventListener('DOMContentLoaded', clearOldCache);