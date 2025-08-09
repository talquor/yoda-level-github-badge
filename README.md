# Yoda-Level GitHub Badge
Generate a Star Wars-themed badge for your GitHub README!

## Demo
[![Yoda-Level Badge](https://img.shields.io/badge/Yoda%20Rank-S%2B%2B%20(Jedi)-brightgreen?logo=github&logoColor=white&style=for-the-badge)](https://github.com/cosminmemetea)

## How to Use
1. Visit [https://cosminmemetea.github.io/yoda-level-github-badge/](https://cosminmemetea.github.io/yoda-level-github-badge/).
2. Enter your GitHub username and (optional) personal access token.
3. Copy the Markdown for your README or share the animated GIF on social media!

## Ranking System
- **S++ (Jedi)**: ≥200 points (e.g., ~1000 commits or ~100 PRs in 30 days).
- **S+, S, S-, S--**: 180–199, 160–179, 140–159, 120–139 points.
- **A+, A**: 100–119, 80–99 points.
- **B+, B, C+, C, C-, D+, D, D-, F+, F**: 60–79, 40–59, 30–39, 20–29, 15–19, 10–14, 5–9, 2–4, 1, 0 points.
- Score: log10(0.8 * Commits + 8 * PRs + 1) * 100 (last 30 days, up to 100 repos).

## Contribute
- Add new ranks in `js/badge.js`.
- Add images in `assets/` for v1.2.
- Fork and submit a PR!

## Deployment
Hosted on GitHub Pages.

## License
This project is licensed under the [MIT License](LICENSE).