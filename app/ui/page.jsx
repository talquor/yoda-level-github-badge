'use client';

import { useMemo, useState, useEffect } from 'react';

// Tiny helpers
const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

const Card = ({ title, subtitle, children, right }) => (
  <div style={{
    position: 'relative',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    overflow: 'hidden'
  }}>
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12}}>
      <div>
        <div style={{fontWeight: 800, letterSpacing: 0.4, color:'#fff'}}>{title}</div>
        {subtitle && <div style={{color:'#9CA3AF', fontSize: 12, marginTop: 2}}>{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const SegButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 10px',
      fontSize: 12,
      borderRadius: 10,
      border: '1px solid ' + (active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)'),
      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      color: '#E5E7EB',
      cursor: 'pointer'
    }}
  >
    {children}
  </button>
);

const Toggle = ({ checked, onChange, label }) => (
  <label style={{display:'inline-flex', alignItems:'center', gap:8, color:'#E5E7EB', fontSize:12, cursor:'pointer'}}>
    <span style={{
      width: 34, height: 20, borderRadius: 12,
      background: checked ? 'linear-gradient(90deg,#22c55e,#86efac)' : 'rgba(255,255,255,0.15)',
      position:'relative', transition:'all .2s'
    }} onClick={() => onChange(!checked)}>
      <span style={{
        position:'absolute', top:2, left: checked ? 16 : 2,
        width: 16, height: 16, borderRadius:'50%', background:'#111827', transition:'all .2s'
      }}/>
    </span>
    {label}
  </label>
);

const CopyBtn = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false), 1500); } catch {}
      }}
      style={{
        padding:'6px 10px', borderRadius:10, fontSize:12, color: ok ? '#111827' : '#111827',
        background: ok ? '#a7f3d0' : '#D1FAE5', border: '1px solid #10b981', cursor:'pointer', fontWeight:600
      }}
      title="Copy Markdown to clipboard"
    >
      {ok ? 'Copied ✓' : 'Copy Markdown'}
    </button>
  );
};

export default function UIShowcase() {
  // Controls
  const [username, setUsername] = useState('talquor');
  const [theme, setTheme] = useState('jedi'); // 'jedi' | 'sith'
  const [streak, setStreak] = useState(true);
  const [streakSource, setStreakSource] = useState('hybrid'); // 'calendar' | 'events' | 'hybrid'
  const [xpStyle, setXpStyle] = useState('saber'); // for rotator
  const [dur, setDur] = useState(4); // seconds/frame rotator

  // Live URLs (relative to same host)
  const userRankUrl = useMemo(() => {
    const q = qs({
      username, badge: 1, xp: 'bar', theme, logo: 'saber',
      streak: streak ? 1 : 0, streakSource
    });
    return `/api/user-rank?${q}`;
  }, [username, theme, streak, streakSource]);

  const rotatorUrl = useMemo(() => {
    const q = qs({
      username, theme, xpStyle, dur, streak: streak ? 1 : 0, streakSource
    });
    return `/api/qrotator-mini?${q}`;
  }, [username, theme, xpStyle, dur, streak, streakSource]);

  const trialsUrl = useMemo(() => {
    const q = qs({ username, theme, detailed: 0 }); // compact strip; try &detailed=1 later
    return `/api/trials?${q}`;
  }, [username, theme]);

  const duelUrl = useMemo(() => {
    const q = qs({ user1: username, user2: 'torvalds', theme });
    return `/api/duel?${q}`;
  }, [username, theme]);

  const streakDebugUrl = useMemo(() => {
    const q = qs({ username, source: streakSource, anchor: 'lastActive', daysBack: 180 });
    return `/api/streak-debug?${q}`;
  }, [username, streakSource]);

  // Markdown snippets
  const md = {
    rank: `![Rank](${userRankUrl})`,
    rotator: `![Quantum Mini](${rotatorUrl})`,
    trials: `![Yoda Trials](${trialsUrl})`,
    duel: `![Duel](${duelUrl})`
  };

  // Background starfield animation (CSS vars)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-accent', theme === 'sith' ? '#f97316' : '#22c55e');
  }, [theme]);

  return (
    <div style={{
      minHeight:'100dvh',
      background:'#0b1020',
      color:'#E5E7EB',
      fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji'
    }}>
      {/* Starfield */}
      <div aria-hidden style={{
        position:'fixed', inset:0, pointerEvents:'none',
        backgroundImage: `
          radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.35) 0, rgba(255,255,255,0) 60%),
          radial-gradient(1px 1px at 80% 30%, rgba(255,255,255,0.25) 0, rgba(255,255,255,0) 60%),
          radial-gradient(1px 1px at 30% 70%, rgba(255,255,255,0.25) 0, rgba(255,255,255,0) 60%),
          radial-gradient(2px 2px at 60% 80%, rgba(255,255,255,0.18) 0, rgba(255,255,255,0) 60%)`,
        backgroundBlendMode:'screen',
        opacity:0.7
      }}/>

      <header style={{maxWidth:1200, margin:'0 auto', padding:'28px 20px 10px'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{
            width:38, height:38, borderRadius:12, background:'linear-gradient(135deg, var(--ui-accent), #60a5fa)',
            display:'grid', placeItems:'center', boxShadow:'0 8px 20px rgba(0,0,0,0.35)'
          }}>
            <span style={{fontSize:18}}>⚔️</span>
          </div>
          <div>
            <div style={{fontSize:20, fontWeight:800, letterSpacing:.4, color:'#fff'}}>Yoda Badge Studio</div>
            <div style={{fontSize:12, color:'#9CA3AF'}}>Live previews · Copy Markdown · Theme toggles</div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <section style={{maxWidth:1200, margin:'0 auto', padding:'6px 20px 24px'}}>
        <Card title="Controls" subtitle="Tweak once, all previews update.">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div style={{
              display:'grid',
              gridTemplateColumns:'160px 1fr',
              rowGap:10, columnGap:12, alignItems:'center'
            }}>
              <div style={{fontSize:12, color:'#9CA3AF'}}>GitHub Username</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="your-username"
                style={{
                  width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.16)',
                  background:'rgba(255,255,255,0.06)', color:'#fff', outline:'none'
                }}
              />

              <div style={{fontSize:12, color:'#9CA3AF'}}>Theme</div>
              <div style={{display:'flex', gap:8}}>
                <SegButton active={theme==='jedi'} onClick={()=>setTheme('jedi')}>Jedi</SegButton>
                <SegButton active={theme==='sith'} onClick={()=>setTheme('sith')}>Sith</SegButton>
              </div>

              <div style={{fontSize:12, color:'#9CA3AF'}}>Streak</div>
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <Toggle checked={streak} onChange={setStreak} label="Show Streak" />
                <SegButton active={streakSource==='calendar'} onClick={()=>setStreakSource('calendar')}>Calendar</SegButton>
                <SegButton active={streakSource==='events'} onClick={()=>setStreakSource('events')}>Events</SegButton>
                <SegButton active={streakSource==='hybrid'} onClick={()=>setStreakSource('hybrid')}>Hybrid</SegButton>
              </div>
            </div>

            <div style={{
              display:'grid',
              gridTemplateColumns:'160px 1fr',
              rowGap:10, columnGap:12, alignItems:'center'
            }}>
              <div style={{fontSize:12, color:'#9CA3AF'}}>Rotator XP Style</div>
              <div style={{display:'flex', gap:8}}>
                <SegButton active={xpStyle==='saber'} onClick={()=>setXpStyle('saber')}>Lightsaber</SegButton>
                <SegButton active={xpStyle==='bar'} onClick={()=>setXpStyle('bar')}>Mini Bar</SegButton>
              </div>

              <div style={{fontSize:12, color:'#9CA3AF'}}>Rotator Speed (sec/frame)</div>
              <input
                type="number" min={2} max={20}
                value={dur} onChange={(e)=>setDur(Math.max(2, Math.min(20, Number(e.target.value)||4)))}
                style={{
                  width:120, padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.16)',
                  background:'rgba(255,255,255,0.06)', color:'#fff', outline:'none'
                }}
              />

              <div style={{fontSize:12, color:'#9CA3AF'}}>Debug</div>
              <a href={streakDebugUrl} target="_blank" rel="noreferrer"
                 style={{fontSize:12, color:'#93C5FD', textDecoration:'underline'}}>Open streak-debug JSON ↗</a>
            </div>
          </div>
        </Card>
      </section>

      {/* Grid */}
      <main style={{maxWidth:1200, margin:'0 auto', padding:'0 20px 80px'}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(12, 1fr)',
          gap:16
        }}>
          {/* Rank */}
          <div style={{gridColumn:'span 6'}}>
            <Card
              title="Rank Badge"
              subtitle="Shields-style — shows tier, XP progress, and streak."
              right={<CopyBtn text={md.rank} />}
            >
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.15)',
                borderRadius:12, padding:14
              }}>
                <img src={userRankUrl} alt="Rank Badge" style={{maxWidth:'100%'}} />
              </div>
              <div style={{fontSize:12, color:'#9CA3AF', marginTop:8}}><code>{userRankUrl}</code></div>
            </Card>
          </div>

          {/* Rotator */}
          <div style={{gridColumn:'span 6'}}>
            <Card
              title="Quantum Rotator Mini"
              subtitle="Animated concept strip + XP lightsaber + optional streak."
              right={<CopyBtn text={md.rotator} />}
            >
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.15)',
                borderRadius:12, padding:14
              }}>
                <img src={rotatorUrl} alt="Rotator" style={{maxWidth:'100%'}} />
              </div>
              <div style={{fontSize:12, color:'#9CA3AF', marginTop:8}}><code>{rotatorUrl}</code></div>
            </Card>
          </div>

          {/* Trials */}
          <div style={{gridColumn:'span 7'}}>
            <Card
              title="Yoda Trials"
              subtitle="Fun achievements based on your activity (compact strip)."
              right={<CopyBtn text={md.trials} />}
            >
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.15)',
                borderRadius:12, padding:14
              }}>
                <img src={trialsUrl} alt="Trials" style={{maxWidth:'100%'}} />
              </div>
              <div style={{fontSize:12, color:'#9CA3AF', marginTop:8}}><code>{trialsUrl}</code></div>
            </Card>
          </div>

          {/* Duel */}
          <div style={{gridColumn:'span 5'}}>
            <Card
              title="Duel"
              subtitle="Face-off between two users (rank vs rank)."
              right={<CopyBtn text={md.duel} />}
            >
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.15)',
                borderRadius:12, padding:14
              }}>
                <img src={duelUrl} alt="Duel" style={{maxWidth:'100%'}} />
              </div>
              <div style={{fontSize:12, color:'#9CA3AF', marginTop:8}}><code>{duelUrl}</code></div>
            </Card>
          </div>

          {/* Placeholders / Coming Soon */}
          <div style={{gridColumn:'span 12', display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16}}>
            <div style={{gridColumn:'span 4'}}>
              <Card title="Leaderboard (Coming Soon)" subtitle="Friends / org / custom lists">
                <Placeholder />
              </Card>
            </div>
            <div style={{gridColumn:'span 4'}}>
              <Card title="Quantum Strip (Coming Soon)" subtitle="Day-by-day concept learning">
                <Placeholder />
              </Card>
            </div>
            <div style={{gridColumn:'span 4'}}>
              <Card title="Collections (Coming Soon)" subtitle="Bundle several badges together">
                <Placeholder />
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Placeholder() {
  return (
    <div style={{
      display:'grid', placeItems:'center', height:120,
      background:'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)',
      borderRadius:10, color:'#93C5FD', fontSize:12, border:'1px dashed rgba(255,255,255,0.16)'
    }}>
      <div style={{textAlign:'center'}}>
        <div style={{fontWeight:700, color:'#E5E7EB'}}>UI Placeholder</div>
        <div style={{opacity:0.85}}>Hook this up to a new /api route anytime</div>
      </div>
    </div>
  );
}
