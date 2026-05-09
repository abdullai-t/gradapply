// Tactile Fusion — Schools page
// School cards with progress bars, stats bento, AI analysis glass card

function Schools() {
  const schools = [
    { name: 'Stanford University', program: 'MS in Artificial Intelligence', progress: 65, deadline: 'Dec 15, 2025', status: 'due', statusText: 'DUE IN 12 DAYS', seal: '#c1272d', accent: 'var(--primary)' },
    { name: 'MIT', program: 'Ph.D. in Computer Science', progress: 100, deadline: 'Submitted Nov 1, 2025', status: 'submitted', statusText: 'SUBMITTED', seal: '#8a1a1a', accent: 'var(--tertiary)' },
    { name: 'ETH Zurich', program: 'MSc in Data Science', progress: 30, deadline: 'Dec 1, 2025', status: 'urgent', statusText: 'URGENT', seal: '#0f4d92', accent: '#ea580c' },
    { name: 'Carnegie Mellon', program: 'MS in Machine Learning', progress: 45, deadline: 'Dec 20, 2025', status: 'due', statusText: 'DUE IN 18 DAYS', seal: '#c41230', accent: 'var(--primary)' },
    { name: 'UC Berkeley', program: 'MS in EECS', progress: 20, deadline: 'Jan 5, 2026', status: 'due', statusText: 'DUE IN 34 DAYS', seal: '#003262', accent: 'var(--primary)' },
  ];

  return (
    <div className="slide-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <h2 className="t-headline-lg" style={{ margin: '0 0 6px' }}>School Applications</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>Track your journey and manage deadlines across every program.</p>
        </div>
        <TacButton icon="add">Add School</TacButton>
      </div>

      {/* Stats bento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40 }}>
        <StatBento icon="assignment" color="rgba(0,98,157,0.08)" fg="var(--primary)" label="Total Apps" value="08" />
        <StatBento icon="pending_actions" color="rgba(83,250,194,0.2)" fg="var(--on-secondary-container)" label="In Progress" value="05" />
        <StatBento icon="check_circle" color="rgba(43,108,0,0.08)" fg="var(--tertiary)" label="Submitted" value="03" />
      </div>

      {/* Schools grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {schools.map(s => <SchoolCard key={s.name} {...s} />)}
        <AddSchoolCard />
      </div>

      {/* AI insight */}
      <AIInsightCard />
    </div>
  );
}

function StatBento({ icon, color, fg, label, value }) {
  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color, display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} style={{ color: fg, fontSize: 24 }} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>{value}</div>
      </div>
    </div>
  );
}

function SchoolCard({ name, program, progress, deadline, status, statusText, seal, accent }) {
  const statusStyles = {
    due: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
    submitted: { bg: 'rgba(43,108,0,0.08)', fg: 'var(--tertiary)', border: 'rgba(43,108,0,0.25)' },
    urgent: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
  };
  const st = statusStyles[status];
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0',
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: hover ? '0 10px 0 0 #cbd5e1' : '0 6px 0 0 #e2e8f0',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <span style={{ padding: '6px 12px', background: st.bg, color: st.fg, border: `1px solid ${st.border}`, fontSize: 10, fontWeight: 900, borderRadius: 999, letterSpacing: '0.08em' }}>
          {statusText}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f8fafc', border: '1px solid #f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: seal, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '-0.02em' }}>
            {name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
        </div>
        <div style={{ paddingRight: 100 }}>
          <h3 className="t-headline-md" style={{ margin: '0 0 4px' }}>{name}</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>{program}</p>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Application Progress</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{progress}%</span>
        </div>
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(226,232,240,0.5)' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: progress === 100 ? 'linear-gradient(90deg, var(--tertiary), var(--tertiary-container))' : 'linear-gradient(90deg, var(--primary), var(--primary-container))',
            borderRadius: 999, transition: 'width 0.6s ease',
          }}></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
          <Icon name={status === 'submitted' ? 'check_circle' : 'event'} style={{ fontSize: 16 }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>{deadline}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {status === 'submitted' ? (
            <button style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>View Receipt</button>
          ) : (
            <>
              <IconBtn icon="edit" />
              <IconBtn icon="delete" danger />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon, danger }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none',
        color: hover ? (danger ? 'var(--error)' : 'var(--primary)') : '#94a3b8',
        cursor: 'pointer', display: 'grid', placeItems: 'center',
      }}>
      <Icon name={icon} style={{ fontSize: 18 }} />
    </button>
  );
}

function AddSchoolCard() {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        border: `3px dashed ${hover ? 'var(--primary-container)' : '#cbd5e1'}`,
        borderRadius: 20, background: hover ? 'rgba(0,163,255,0.03)' : 'transparent',
        padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.2s', gap: 12, minHeight: 300,
      }}>
      <div style={{
        width: 64, height: 64, borderRadius: 999,
        background: hover ? 'rgba(0,163,255,0.1)' : '#f1f5f9',
        color: hover ? 'var(--primary)' : '#94a3b8',
        display: 'grid', placeItems: 'center', transition: 'all 0.2s',
      }}>
        <Icon name="add_business" style={{ fontSize: 32 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, color: hover ? 'var(--primary)' : '#64748b' }}>Add New School</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Start your next application</div>
      </div>
    </div>
  );
}

function AIInsightCard() {
  return (
    <div style={{
      marginTop: 48, padding: 32, borderRadius: 32, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))',
      backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.7)',
      boxShadow: '0 20px 60px -20px rgba(0,98,157,0.15)',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, background: 'rgba(0,163,255,0.2)', filter: 'blur(80px)', borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 180, height: 180, background: 'rgba(43,108,0,0.1)', filter: 'blur(70px)', borderRadius: '50%' }}></div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, var(--primary), var(--primary-container))',
          color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: '0 10px 24px rgba(0,98,157,0.3)',
        }}>
          <Icon name="auto_awesome" fill style={{ fontSize: 36 }} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 className="t-headline-md" style={{ margin: '0 0 6px' }}>ScholarQuest AI Analysis</h4>
          <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
            Based on your profile and track record, you have a <strong style={{ color: 'var(--primary)' }}>82% acceptance likelihood</strong> at ETH Zurich. Completing your Statement of Purpose this week would meet the early deadline.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#334155', cursor: 'pointer', fontFamily: 'inherit' }}>View Recommendations</button>
            <button style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Draft SOP with AI →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Schools = Schools;
