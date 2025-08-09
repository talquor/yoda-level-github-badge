export async function fetchGitHubData(url, token) {
    const headers = token ? { Authorization: `token ${token}` } : {};
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 404) throw new Error('User or resource not found.');
            if (response.status === 403) throw new Error('Too many requests! Try again later or use a token.');
            throw new Error(`API error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        throw error;
    }
}