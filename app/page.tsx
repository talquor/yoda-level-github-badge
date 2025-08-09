export default function Page() {
  const base = typeof window === 'undefined'
    ? 'https://your-vercel-app.vercel.app'
    : '';

  const demo = `${base}/api/badge?label=Yoda%20Rank&persona=Jedi&grade=S%2B%2B&logo=github`;
  const demoPoints = `${base}/api/badge?points=98&logo=github`;

  return (
    <main className="container">
      <div className="card">
        <h1 className="h1">🛡️ Yoda Level GitHub Badge</h1>
        <p className="sub">Shields-like “for-the-badge” SVG, with order <strong>“Jedi (S++)”</strong>.</p>

        <p><strong>Quick demo:</strong></p>
        <p>
          <img src="/api/badge?label=Yoda%20Rank&persona=Jedi&grade=S%2B%2B&logo=github" alt="Demo badge"/>
        </p>

        <h3>Usage</h3>
        <p>Put this in your README:</p>
        <pre><code>![Yoda Rank](https://your-vercel-app.vercel.app/api/badge?label=Yoda%20Rank&amp;persona=Jedi&amp;grade=S%2B%2B&amp;logo=github)</code></pre>

        <p>Or auto-map by points:</p>
        <pre><code>![Yoda Rank](https://your-vercel-app.vercel.app/api/badge?points=98&amp;logo=github)</code></pre>

        <h3>Query params</h3>
        <ul>
          <li><code>label</code> – left text (default: <code>Yoda Rank</code>)</li>
          <li><code>persona</code> – e.g. <code>Jedi</code></li>
          <li><code>grade</code> – e.g. <code>S++</code></li>
          <li><code>points</code> – 0..100 (auto maps to persona/grade/color)</li>
          <li><code>logo</code> – <code>github</code> to show GH mark (optional)</li>
          <li><code>color</code> – hex override for right side color (optional)</li>
        </ul>
      </div>
    </main>
  );
}
