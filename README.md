# 🛡️ Yoda Level GitHub Badge

Turn GitHub activity into a **cinematic, Shields-style badge**.  
Format: **Rank: Jedi (S++)** — same vibe as “for-the-badge”, but custom.

<div align="center">

Granular + dots XP (default) + points + next
![Yoda Rank](https://yoda-level-github-badge.vercel.app/api/user-rank?username=cosminmemetea&badge=1&logo=galaxy&granular=1&showPoints=1&showNext=1)

Granular + bar XP
![Yoda Rank](https://yoda-level-github-badge.vercel.app/api/user-rank?username=cosminmemetea&badge=1&logo=saber&granular=1&xp=bar&showPoints=1)


Manual points + bar XP
![Yoda Rank](https://yoda-level-github-badge.vercel.app/api/badge?points=82.5&label=Yoda%20Rank&logo=galaxy&granular=1&xp=bar&showPoints=1&showNext=1)

</div>

---

## ✨ What it does

- **Badge endpoint**: `/api/badge` – render any persona/grade, or map from points.
- **Smart rank endpoint**: `/api/user-rank` – pull a user’s GitHub history, score it (0–100), map to a tier, and return **JSON** or the **badge**.
- **Clean “for-the-badge” look** with custom **Star-warsy icons**:
  - `logo=saber` → minimalist lightsaber
  - `logo=galaxy` → starburst/galactic sigil
  - `logo=github` → GitHub mark

---

## 🚀 Quick Start (README embeds)

**Auto-computed from GitHub history (recommended):**

```md
![Rank](https://YOUR-APP.vercel.app/api/user-rank?username=cosminmemetea&badge=1&label=Yoda%20Rank&logo=saber)
```

```md
![Rank](https://YOUR-APP.vercel.app/api/user-rank?username=torvalds&badge=1&label=Yoda%20Rank&logo=galaxy)
```

**Manual (fixed values or by points):**

```md
![Rank](https://YOUR-APP.vercel.app/api/badge?label=Yoda%20Rank&persona=Jedi&grade=S%2B%2B&logo=galaxy)
```

```md
![Rank](https://YOUR-APP.vercel.app/api/badge?points=98&label=Yoda%20Rank&logo=saber)
```

> Replace `YOUR-APP` with your Vercel domain.

---

## 🔧 Endpoints & Params

### `/api/user-rank`
- `username` *(required)* – GitHub login, e.g. `octocat`
- `badge=1` – return the **SVG badge** instead of JSON
- `label` – left text (default: `Rank`)
- `logo` – `saber` | `galaxy` | `github`
- `t` – cache buster (any value) to force refresh

Example JSON:
```
/api/user-rank?username=octocat
```

Example badge:
```
/api/user-rank?username=octocat&badge=1&logo=saber
```

### `/api/badge`
- `label` – left text (default: `Rank`)
- `persona` – e.g. `Jedi`
- `grade` – e.g. `S++`
- `points` – `0..100` (auto maps to persona/grade/color)
- `color` – override right-side color (`#RRGGBB`)
- `logo` – `saber` | `galaxy` | `github`

---

## 🧠 Ranking System (points → tier)

- **S++ (Jedi)**: 98–100  
- **S+, S, S-, S--**: Master Yoda, Grand Master, Jedi Master, Darth Vader  
- **A+, A**: Obi-Wan Kenobi, Jedi Knight  
- **B+ … F**: Luke Skywalker → Force Beginner  

**Auto-scoring signals** (GraphQL if `GITHUB_TOKEN` set; otherwise REST heuristics):

- Commits, PRs, Issues, Reviews, Repo contributions
- Stars, forks, repo freshness, language breadth
- Followers, account age, recent public events

> Add `GITHUB_TOKEN` in Vercel → Project Settings → Environment Variables to unlock GraphQL accuracy + higher rate limits.

---

## 🛠️ Local Dev

```bash
npm i
npm run dev
# http://localhost:3000/api/badge
# http://localhost:3000/api/user-rank?username=octocat
```

---

## ⚙️ Deploy (Vercel)

1. Push this repo to GitHub.
2. Import in Vercel.
3. (Optional) Add `GITHUB_TOKEN` for GraphQL scoring.
4. Use the URLs in your README.

---

## 🎨 Themes & Icons

- Left segment: dark slate
- Right segment: tier color (auto-picked by points; overridable with `color`).
- Icons:
  - `logo=saber` → **minimal lightsaber** (clean, futuristic)
  - `logo=galaxy` → **starburst sigil** (sky-war vibe)
  - `logo=github` → GitHub mark

---

## 🧾 License

MIT – customize, remix, and have fun.


docker build -t yoda-badge:local .
docker run -d --name yoda-badge -p 3000:3000 yoda-badge:local


