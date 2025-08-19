# 🌌 Yoda-Level GitHub Badge

Turn GitHub activity into a cinematic, Shields-style **Rank** badge — with **granular sub-ranks (I–IV)**, a colorful **XP indicator**, **Jedi/Sith themes**, **classic streaks**, and shareable **head-to-head Duels**.

<p align="center">
  <a href="https://yoda-level-github-badge.vercel.app/api/user-rank?username=talquor&badge=1&granular=1&showPoints=1&showNext=1&streak=1&logo=galaxy">
    <img alt="Rank" src="https://yoda-level-github-badge.vercel.app/api/user-rank?username=talquor&badge=1&granular=1&showPoints=1&showNext=1&streak=1&logo=galaxy" />
  </a>
</p>

---

## ✨ Features

- **Auto-computed rank (0–100)** from GitHub activity (GraphQL preferred; REST fallback)
- **Granular sub-ranks** inside each tier: I → II → III → IV
- **XP indicator**: dots or bar, color-ramped by progress
- **Themes**: `jedi` (space-blue) or `sith` (crimson/black)
- **Classic streaks** (consecutive days with ≥1 contribution) — optional momentum mode
- **Rank Duels**: shareable SVG posters for A vs B
- **Zero front-end required**: all endpoints return SVG (or JSON for data view)

---

## 🧪 Quick Start (README usage)

**Personal badge (auto):**
```md
[![Rank](https://yoda-level-github-badge.vercel.app/api/user-rank?username=cosminmemetea&badge=1&granular=1&showPoints=1&showNext=1&streak=1&logo=galaxy)](https://yoda-level-github-badge.vercel.app/api/user-rank?username=cosminmemetea)
````

**Torvalds (Sith theme + bar XP):**

```md
[![Rank](https://yoda-level-github-badge.vercel.app/api/user-rank?username=torvalds&badge=1&granular=1&xp=bar&theme=sith&logo=saber)](https://yoda-level-github-badge.vercel.app/api/user-rank?username=torvalds)
```

**Rank Duel — Cosmin vs Torvalds:**

```md
[![Rank Duel: cosminmemetea vs torvalds](https://yoda-level-github-badge.vercel.app/api/duel?u1=cosminmemetea&u2=torvalds&theme=jedi&xp=bar&logo=galaxy)](https://yoda-level-github-badge.vercel.app/api/duel?u1=cosminmemetea&u2=torvalds&theme=jedi&xp=bar&logo=galaxy)
```

**Rank Duel — Cosmin vs drmxm:**

```md
[![Rank Duel: cosminmemetea vs drmxm](https://yoda-level-github-badge.vercel.app/api/duel?u1=cosminmemetea&u2=drmxm&theme=jedi&xp=bar&logo=galaxy)](https://yoda-level-github-badge.vercel.app/api/duel?u1=cosminmemetea&u2=drmxm&theme=jedi&xp=bar&logo=galaxy)
```

**Manual points badge (no GitHub calls):**

```md
![Rank](https://yoda-level-github-badge.vercel.app/api/badge?points=82.5&label=Rank&granular=1&xp=bar&showPoints=1&showNext=1&logo=galaxy)
```


**Animated (4s per concept, large, Jedi):**

![Quantum Rotator](https://yoda-level-github-badge.vercel.app/api/qrotator?size=lg&theme=jedi&dur=4)


**Animated (Sith theme, slower 8s):**

![Quantum Rotator](https://yoda-level-github-badge.vercel.app/api/qrotator?size=lg&theme=sith&dur=8)


**Static frame (e.g., Entanglement) for screenshots or if someone’s viewer doesn’t animate:**

![Quantum Rotator](https://yoda-level-github-badge.vercel.app/api/qrotator?size=lg&theme=jedi&frame=entanglement)


**Disable wrapping (if you prefer one-liners only):**

![Quantum Rotator](https://yoda-level-github-badge.vercel.app/api/qrotator?size=md&wrap=0)


**Mini rotator**
Animated (Jedi, 4s each):
```bash
https://<your-app>.vercel.app/api/qrotator-mini?theme=jedi&dur=4

Animated (Sith, 8s):
https://<your-app>.vercel.app/api/qrotator-mini?theme=sith&dur=8

Static frame (Entanglement):
https://<your-app>.vercel.app/api/qrotator-mini?frame=entanglement

```
Force camo refresh while testing: add &t=now.

![Quantum Concepts](https://yoda-level-github-badge.vercel.app/api/qrotator-mini?theme=jedi&dur=4)


Tip while testing: append &t=now to force proxy recache.

> Replace the domain with your deployment if different.

---

## 🔌 Endpoints

### 1) `/api/user-rank` — Compute rank from GitHub

* **Method**: `GET`
* **Returns**: `SVG` when `badge=1`, otherwise `JSON`

**Core params**

| Param          | Type   |   Default | Description                                                       |                                                          |
| -------------- | ------ | --------: | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `username`     | string |         — | GitHub username (required)                                        |                                                          |
| `badge`        | \`0    |       1\` | `0`                                                               | `1` → return SVG badge; `0` → JSON                       |
| `label`        | string |    `Rank` | Left-side label                                                   |                                                          |
| `logo`         | enum   |   `saber` | `galaxy` \| `saber` \| `github`                                   |                                                          |
| `theme`        | enum   |    `jedi` | `jedi` \| `sith`                                                  |                                                          |
| `granular`     | \`0    |       1\` | `0`                                                               | Show sub-rank I–IV inside the tier                       |
| `xp`           | enum   |    `dots` | `dots` \| `bar` \| `none`                                         |                                                          |
| `showPoints`   | \`0    |       1\` | `0`                                                               | Append score (e.g., `82.5 pts`)                          |
| `showNext`     | \`0    |       1\` | `0`                                                               | Append delta to next tier (e.g., `+2.0 to Grand Master`) |
| `streak`       | \`0    |       1\` | `0`                                                               | Show streak on the badge text                            |
| `streakMode`   | enum   | `classic` | `classic` (consecutive days ≥1) \| `momentum` (7-day sum uptrend) |                                                          |
| `streakWindow` | number |     `120` | Days of history for streak calc (30–365)                          |                                                          |

**JSON example**

```
/api/user-rank?username=cosminmemetea
```

```json
{
  "username": "cosminmemetea",
  "points": 73.4,
  "rank": "B",
  "persona": "Rebel Pilot",
  "color": "#8b5cf6",
  "method": "graphql",
  "streak": { "mode": "classic", "days": 5 },
  "granular": { "band": "II", "nextTier": "Rebel Commander", "pointsToNext": 1.6, "pctWithinTier": 41.2 },
  "tiers": [
    { "grade": "S++", "name": "Master Yoda", "min": 98 },
    ...
  ]
}
```

**SVG example**

```
/api/user-rank?username=torvalds&badge=1&granular=1&xp=bar&theme=sith&streak=1&logo=saber
```

---

### 2) `/api/badge` — Static/custom badge (no GitHub calls)

* **Method**: `GET`
* **Returns**: `SVG`

**Params**

| Param        | Type   |       Default | Description                                                 |                           |
| ------------ | ------ | ------------: | ----------------------------------------------------------- | ------------------------- |
| `label`      | string |        `Rank` | Left-side text                                              |                           |
| `persona`    | string | `Master Yoda` | Right persona (ignored if `points` is provided)             |                           |
| `grade`      | string |         `S++` | Right grade (ignored if `points` is provided)               |                           |
| `points`     | number |             — | If provided, maps points→tier and fills persona/grade/color |                           |
| `granular`   | \`0    |           1\` | `0`                                                         | Show I–IV inside tier     |
| `xp`         | enum   |        `dots` | `dots` \| `bar` \| `none`                                   |                           |
| `showPoints` | \`0    |           1\` | `0`                                                         | Append numeric points     |
| `showNext`   | \`0    |           1\` | `0`                                                         | Add distance to next tier |
| `logo`       | enum   |       `saber` | `galaxy` \| `saber` \| `github`                             |                           |
| `theme`      | enum   |        `jedi` | `jedi` \| `sith`                                            |                           |

**Examples**

```
/api/badge?points=82.5&label=Rank&granular=1&xp=bar&showPoints=1&showNext=1&logo=galaxy
```

---

### 3) `/api/duel` — Head-to-head Rank Duel (shareable SVG poster)

* **Method**: `GET`
* **Returns**: `SVG`

**Params**

| Param   | Type   |     Default | Description                       |
| ------- | ------ | ----------: | --------------------------------- |
| `u1`    | string |           — | First GitHub username (required)  |
| `u2`    | string |           — | Second GitHub username (required) |
| `label` | string | `Rank Duel` | Title displayed at top            |
| `logo`  | enum   |    `galaxy` | `galaxy` \| `saber` \| `github`   |
| `xp`    | enum   |       `bar` | `dots` \| `bar` \| `none`         |
| `theme` | enum   |      `jedi` | `jedi` \| `sith`                  |

**Examples**

```
/api/duel?u1=cosminmemetea&u2=torvalds&theme=jedi&xp=bar&logo=galaxy
/api/duel?u1=cosminmemetea&u2=drmxm&theme=jedi&xp=bar&logo=galaxy
```

---

## 🧮 Ranking System (0–100 → Persona)

* **S++**: Master Yoda (98–100)
* **S+**: Grand Master (≥96) • **S**: Jedi Master (≥94) • **S-**: Jedi Council (≥92) • **S--**: Sith Lord (≥90)
* **A+**: Obi-Wan Kenobi (≥85) • **A**: Jedi Knight (≥80)
* **B+**: Rebel Commander (≥75) • **B**: Rebel Pilot (≥70)
* **C+**: Padawan (≥65) • **C**: Youngling (≥60) • **C-**: Academy Cadet (≥55)
* **D+**: Frontier Scout (≥50) • **D**: Cantina Regular (≥45) • **D-**: Scrapyard Tech (≥40)
* **F+**: Moisture Farmer (≥30) • **F**: Force Beginner (≥0)

Sub-ranks inside each tier: **I** (entry) → **IV** (top).

---

## 🔐 Environment Variables

| Name           |   Required  | Purpose                                                                                                                                                 |
| -------------- | :---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | Recommended | Enables GitHub **GraphQL** (richer metrics + 5,000 req/hr). Public-data scope is enough. Without it, the app falls back to REST with lower rate limits. |

**Vercel**: Project → *Settings → Environment Variables* → add `GITHUB_TOKEN`, redeploy.
**Local**: create `.env.local`:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 Deployment (Vercel)

```bash
# install
npm i

# local dev
npm run dev

# build check
npm run build
```

* Push to GitHub.
* Import the repo into **Vercel**.
* Set `GITHUB_TOKEN` (optional but recommended).
* Vercel auto-builds when you push.

---

## 🧰 Implementation Notes

* **Edge Runtime** routes (`app/api/**/route.ts`) for fast cold starts.
* SVG is **XML-safe** (attributes/text escaped; decimals use `0.x` not `.x`).
* **Caching**: responses set `s-maxage` for CDN caching; add `&t=<nonce>` to bust caches if needed.
* **XP colors** ramp with progress: red → amber → lime → green (Sith palette adjusts hues).
* **Legend override**: obvious legends (e.g., `torvalds`) are clamped to 100 to ensure “Yoda (S++)”.

---

## 🛠 Troubleshooting

* **Broken SVG / XML error**: You’re hitting older code or a cached response. Re-deploy and add `&t=1` to the URL.
* **Module not found (`@/lib/...`)**:

  * Ensure `tsconfig.json` has:

    ```json
    { "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"] } } }
    ```
  * Or use relative imports like `../../../lib/rank`.
* **TypeScript error about `'none'` for `progressVariant`**: Make sure `/api/duel` maps `xp=none` → `undefined` (fixed in current version).
* **Rate limited / `"method":"rest"`**: Set `GITHUB_TOKEN` in env and redeploy.

---

## 📄 License

MIT — use anywhere, contributions welcome.

---

## 🙌 Credits

Built with Next.js App Router + Edge Functions. Star Wars-inspired styling for fun; not affiliated with Lucasfilm/Disney. GitHub data via REST/GraphQL APIs.
