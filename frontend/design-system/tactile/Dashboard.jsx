// Tactile Fusion — Dashboard
// Welcome header, weekly streak tracker, readiness gauge, daily mission, document status, recommended schools

function Dashboard() {
  return (
    <div className="slide-in">
      {/* Welcome */}
      <header className="rise-in" style={{ marginBottom: 40, animationDelay: '0.05s' }}>
        <h1 className="t-display-lg" style={{ margin: 0, color: 'var(--on-background)' }}>Welcome back, Alex</h1>
        <p className="t-body-lg" style={{ margin: '8px 0 0', color: 'var(--on-surface-variant)' }}>
          You're making great progress. Your next deadline is in <span style={{ color: 'var(--primary)', fontWeight: 700 }}>12 days</span>.
        </p>
      </header>

      {/* Weekly Streak Card */}
      <div className="rise-in" style={{ animationDelay: '0.15s' }}>
        <StreakCard />
      </div>

      {/* Gauge + Mission */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 24 }}>
        <div className="rise-in" style={{ animationDelay: '0.25s' }}>
          <ReadinessGauge />
        </div>
        <div className="rise-in" style={{ animationDelay: '0.35s' }}>
          <DailyMission />
        </div>
      </div>

      {/* Document status */}
      <div style={{ marginTop: 24 }}>
        <h2 className="t-headline-md rise-in" style={{ margin: '0 0 16px', color: 'var(--on-surface)', animationDelay: '0.45s' }}>Application Documents</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: 'article', color: 'primary', status: 'In Progress', title: 'Statement of Purpose', body: 'Second draft completion. Goal: 1000 words.', cta: 'Continue editing', ctaIcon: 'arrow_forward' },
            { icon: 'task', color: 'error', status: 'Action Needed', title: 'Transcripts', body: 'Official PDF for Michigan is missing.', cta: 'Upload document', ctaIcon: 'upload' },
            { icon: 'group', color: 'tertiary', status: 'Pending', title: 'Letters of Rec', body: 'Dr. Aris requested a follow-up reminder.', cta: 'View status', ctaIcon: 'visibility' },
          ].map((p, i) => (
            <div key={p.title} className="rise-in" style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
              <DocStatusCard {...p} />
            </div>
          ))}
        </div>
      </div>

      {/* Recommended schools */}
      <section style={{ marginTop: 48 }}>
        <div className="rise-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, animationDelay: '0.7s' }}>
          <h2 className="t-headline-lg" style={{ margin: 0 }}>Recommended Schools</h2>
          <button style={{ background: 'rgba(0,98,157,0.05)', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>View All Schools</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { name: 'MIT', program: 'Ph.D. in Computer Science', score: 98, tag: 'High Match', tagColor: 'var(--tertiary)', deadline: 'Dec 15', seal: '#8a1a1a' },
            { name: 'Stanford', program: 'MS in AI', score: 94, tag: 'Dream Match', tagColor: 'var(--primary)', deadline: 'Jan 5', seal: '#c1272d' },
            { name: 'ETH Zurich', program: 'MSc in Robotics', score: 91, tag: 'Solid Match', tagColor: 'var(--secondary)', deadline: 'Dec 1', seal: '#0f4d92' },
          ].map((p, i) => (
            <div key={p.name} className="rise-in" style={{ animationDelay: `${0.75 + i * 0.08}s` }}>
              <RecSchoolCard {...p} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StreakCard() {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const states = ['done', 'done', 'done', 'done', 'today', 'pending', 'pending'];
  return (
    <div className="tactile-card" style={{ background: '#fff', border: '2px solid var(--outline-variant)', borderRadius: 32, padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff7ed', border: '2px solid #fed7aa', display: 'grid', placeItems: 'center' }}>
            <Icon name="local_fire_department" fill className="flame" style={{ fontSize: 34 }} />
          </div>
          <div>
            <div className="t-headline-md" style={{ margin: 0 }}>12 Day Streak</div>
            <div className="t-label-lg" style={{ color: '#94a3b8', fontWeight: 800 }}>Goal: 15 Days</div>
          </div>
        </div>
        <TacButton>View Progress</TacButton>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12,
        background: 'rgba(240,244,252,0.5)', padding: 16, borderRadius: 24, border: '1px solid #f1f5f9',
      }}>
        {days.map((d, i) => <StreakDay key={d} day={d} state={states[i]} delay={0.3 + i * 0.07} />)}
      </div>
    </div>
  );
}

function StreakDay({ day, state, delay }) {
  const isDone = state === 'done';
  const isToday = state === 'today';
  const bg = isDone ? 'var(--primary)' : isToday ? 'rgba(207,229,255,0.6)' : 'var(--surface-container)';
  const shadow = isDone ? '0 4px 0 0 #004a77' : isToday ? 'none' : 'none';
  const border = isToday ? '2px dashed var(--primary)' : isDone ? 'none' : '2px solid #e2e8f0';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: isToday ? 'var(--primary)' : isDone ? '#64748b' : '#cbd5e1', letterSpacing: '0.05em' }}>{day}</span>
      <div className="fill-up" style={{
        width: 44, height: 44, borderRadius: 999,
        background: bg, display: 'grid', placeItems: 'center',
        boxShadow: shadow, border: border, animationDelay: delay + 's',
      }}>
        {isDone && <Icon name="check" fill style={{ color: '#fff', fontSize: 22 }} />}
        {isToday && <Icon name="play_arrow" fill className="bob" style={{ color: 'var(--primary)', fontSize: 20 }} />}
      </div>
    </div>
  );
}

function CountUp({ to, suffix = '', duration = 1200, delay = 0, style }) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now() + delay;
    const tick = (now) => {
      const t = Math.max(0, now - start);
      const p = Math.min(1, t / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);
  return <span style={style}>{val}{suffix}</span>;
}

function ReadinessGauge() {
  const pct = 82;
  return (
    <div className="tactile-card" style={{ background: '#fff', border: '2px solid var(--outline-variant)', borderRadius: 24, padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div className="gauge-sweep" style={{
          position: 'relative', width: 196, height: 196, borderRadius: '50%',
          display: 'grid', placeItems: 'center', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.08)', flexShrink: 0,
          '--gauge-pct': `${pct}%`,
        }}>
          <div style={{ width: '85%', height: '85%', background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
              <CountUp to={pct} suffix="%" duration={1400} delay={300} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>Readiness</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatTile icon="school" tint="rgba(0,98,157,0.08)" tintFg="var(--primary)" value="12" label="Schools Saved" delay={0.4} />
          <StatTile icon="pending_actions" tint="rgba(43,108,0,0.08)" tintFg="var(--tertiary)" value="3" label="LORs Pending" accent="var(--tertiary)" delay={0.5} />
          <StatTile icon="event" tint="rgba(186,26,26,0.08)" tintFg="var(--error)" value="Oct 15" label="Next Deadline" delay={0.6} />
          <StatTile icon="history_edu" tint="rgba(0,98,157,0.08)" tintFg="var(--primary)" value="2/4" label="Essays Drafted" accent="var(--primary)" delay={0.7} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, tint, tintFg, value, label, accent, delay = 0 }) {
  return (
    <div className="stat-tile pop-number" style={{
      background: 'var(--surface-container-low)', padding: 18, borderRadius: 16,
      border: '2px solid #f1f5f9', borderBottom: `4px solid ${accent || '#e2e8f0'}`,
      cursor: 'default', animationDelay: delay + 's',
    }}>
      <div style={{ width: 36, height: 36, background: tint, borderRadius: 10, display: 'grid', placeItems: 'center', marginBottom: 10, transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <Icon name={icon} style={{ color: tintFg, fontSize: 20 }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function DailyMission() {
  return (
    <div className="tactile-card aura shine-sweep" style={{
      background: 'linear-gradient(135deg, var(--primary), #004a77)', color: '#fff',
      borderRadius: 24, padding: 32, position: 'relative', overflow: 'hidden',
      borderBottom: '8px solid #003354', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 280,
    }}>
      <div className="float-blob" style={{ position: 'absolute', right: -60, bottom: -60, width: 220, height: 220, background: 'rgba(0,163,255,0.35)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
      <div className="float-blob" style={{ position: 'absolute', left: -30, top: 0, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)', animationDelay: '1.5s' }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 999, fontSize: 10, letterSpacing: '0.2em', fontWeight: 900, marginBottom: 20 }}>
          <span className="dot-blink" style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }}></span>
          DAILY MISSION
        </div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>Refine SOP abstract</h2>
        <p style={{ margin: '10px 0 0', color: 'rgba(224,242,254,0.85)', fontSize: 15, lineHeight: 1.55 }}>
          Make your opening paragraph unforgettable for Stanford's admissions committee.
        </p>
      </div>
      <button style={{
        background: '#fff', color: 'var(--primary)', fontWeight: 900, border: 'none',
        padding: '18px 20px', borderRadius: 16, fontSize: 15, cursor: 'pointer',
        fontFamily: 'inherit', marginTop: 24, position: 'relative', zIndex: 1,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.25)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}>
        Start Mission
        <Icon name="arrow_forward" className="arrow-nudge" style={{ fontSize: 18 }} />
      </button>
    </div>
  );
}

function DocStatusCard({ icon, color, status, title, body, cta, ctaIcon }) {
  const colorMap = {
    primary: { bg: 'rgba(0,98,157,0.08)', fg: 'var(--primary)', pill: 'rgba(43,108,0,0.12)', pillFg: 'var(--tertiary)', pillLabel: status },
    error: { bg: 'rgba(186,26,26,0.08)', fg: 'var(--error)', pill: 'rgba(186,26,26,0.12)', pillFg: 'var(--error)' },
    tertiary: { bg: 'rgba(43,108,0,0.08)', fg: 'var(--tertiary)', pill: '#f1f5f9', pillFg: '#64748b' },
  };
  const c = colorMap[color];
  return (
    <div className="tactile-card doc-card" style={{ background: '#fff', border: `2px solid ${color === 'tertiary' ? 'rgba(43,108,0,0.25)' : '#e2e8f0'}`, borderRadius: 24, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="doc-icon" style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: 'grid', placeItems: 'center', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <Icon name={icon} style={{ color: c.fg, fontSize: 26 }} />
        </div>
        <span style={{
          padding: '6px 14px', borderRadius: 999, background: c.pill, color: c.pillFg,
          fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
          border: color === 'primary' ? '1px solid rgba(43,108,0,0.3)' : color === 'error' ? '1px solid #fecaca' : 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {color === 'error' && <span className="dot-blink" style={{ width: 6, height: 6, background: 'var(--error)', borderRadius: '50%' }}></span>}
          {status}
        </span>
      </div>
      <h4 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{title}</h4>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>{body}</p>
      <div className="doc-cta" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
        {cta}
        <Icon name={ctaIcon} className="doc-cta-icon" style={{ fontSize: 16, transition: 'transform 0.2s' }} />
      </div>
      <style>{`
        .doc-card:hover .doc-icon { transform: scale(1.08) rotate(-4deg); }
        .doc-card:hover .doc-cta-icon { transform: translateX(4px); }
      `}</style>
    </div>
  );
}

function RecSchoolCard({ name, program, score, tag, tagColor, deadline, seal }) {
  return (
    <div className="tactile-card school-card" style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 24, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="school-seal" style={{ width: 52, height: 52, borderRadius: 16, background: '#f8fafc', border: '2px solid #f1f5f9', display: 'grid', placeItems: 'center', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: seal, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: '-0.02em' }}>
            {name.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: tagColor, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>{tag}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            <CountUp to={score} suffix="%" duration={1200} delay={500} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>{name}</h4>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{program}</div>
      </div>
      <div style={{ paddingTop: 20, borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="calendar_today" style={{ color: '#cbd5e1', fontSize: 16 }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{deadline}</span>
        </div>
        <TacButton>Apply</TacButton>
      </div>
      <style>{`
        .school-card:hover .school-seal { transform: scale(1.06) rotate(-3deg); }
      `}</style>
    </div>
  );
}

window.Dashboard = Dashboard;
