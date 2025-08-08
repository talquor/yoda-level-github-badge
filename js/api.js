export async function fetchGitHubData(url, token) {
    const headers = token ? { Authorization: `token ${token}` } : {};
    const response = await fetch(url, { headers });
    if (response.status === 404) {
        throw new Error('User or resource not found.');
    } else if (response.status === 403) {
        throw new Error('Too many requests! Try again later or add a personal token.');
    } else if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    return await response.json();
}