# Yoda-Level GitHub Badge
A Star Wars-themed badge showcasing your GitHub rank, from Supreme Yoda to Force Beginner!

## Demo
[![Yoda-Level Badge](https://<your-username>.github.io/yoda-level-github-badge/badge?user=YourUsername&rank=S)](https://github.com/YourUsername)

## How to Use
1. Visit [https://<your-username>.github.io/yoda-level-github-badge](https://<your-username>.github.io/yoda-level-github-badge).
2. Enter your GitHub username and (optional) personal access token.
3. Copy the Markdown for your README or share the animated GIF on social media!

## Ranking System
- **S++ (Supreme Yoda)**: 98–100 points (~160 commits or ~22 PRs in 30 days).
- **S+, S, S-, S--**: Master Yoda, Grand Master, Jedi Master, Darth Vader.
- **A+, A**: Obi-Wan Kenobi, Jedi Knight.
- **B+, B, C+, C, C-, D+, D, D-, F+, F**: From Luke Skywalker to Force Beginner.
- Score: Commits * 0.6 + PRs * 4 (last 30 days).

## Contribute
- Add new ranks in `js/badge.js`.
- Add images in `assets/` for v1.2.
- Fork and submit a PR!

## Deployment
Hosted on GitHub Pages. To deploy:
1. Clone this repo.
2. Update `dynamicBadgeUrl` in `js/badge.js` with your GitHub Pages URL.
3. Push to `main` branch and enable GitHub Pages in Settings.