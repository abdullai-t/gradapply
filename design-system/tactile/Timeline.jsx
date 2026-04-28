// Tactile Fusion — Timeline page
// Hero reminder, month-grouped vertical timeline, progress aside

function Timeline() {
  return (
    <div className="slide-in">
      {/* Hero active reminder */}
      <div style={{
        borderRadius: 32, padding: 40, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--primary-container), var(--primary))',
        color: '#fff', boxShadow: '0 20px 40px -10px rgba(0,98,157,0.3)', marginBottom: 40,
      }}>
        <div style={{ position: 'absolute', top: 20, right: 32, opacity: 0.12 }}>
          <Icon name="event_upcoming" style={{ fontSize: 140 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 520 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--secondary-container)', animation: 'flamePulse 2s infinite' }}></span>
              Active Reminder
            </span>
            <h2 className="t-display-lg" style={{ margin: '0 0 10px' }}>Stanford Early Action</h2>
            <p style={{ margin: 0, color: 'rgba(224,242,254,0.85)', fontSize: 17, lineHeight: 1.55 }}>
              Your statement of purpose for Stanford is due in 3 days. We've optimized your final draft for impact.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{
              background: '#fff', color: 'var(--primary)', border: 'none',
              padding: '14px 22px', borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 0 0 #e2e8f0', transition: 'transform 0.1s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
            onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              Review Draft <Icon name="arrow_forward" style={{ fontSize: 18 }} />
            </button>
            <button style={{
              background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.3)',
              padding: '14px 22px', borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="calendar_month" style={{ fontSize: 18 }} /> Snooze
            </button>
          </div>
        </div>
      </div>

      {/* Timeline body */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h3 className="t-headline-lg" style={{ margin: 0 }}>Application Journey</h3>
            <div style={{ display: 'flex', background: 'var(--surface-container)', padding: 4, borderRadius: 12 }}>
              <button style={{ padding: '8px 16px', background: '#fff', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13, color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}>Timeline</button>
              <button style={{ padding: '8px 16px', background: 'transparent', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>List View</button>
            </div>
          </div>

          <TimelineMonth month="November" count="2 Deadlines" active>
            <TLCard iconColor="var(--primary)" icon="account_balance" name="Princeton University" program="Single-Choice Early Action" deadline="Nov 01, 2025" deadlineColor="var(--error)" extra={{ icon: 'check_circle', text: 'CommonApp Linked', color: 'var(--secondary)' }} />
            <TLCard iconColor="var(--primary)" icon="palette" name="RISD Art Portfolio" program="Early Action Submission" deadline="Nov 15, 2025" deadlineColor="#94a3b8" extra={{ icon: 'pending', text: '75% Complete', color: 'var(--tertiary)' }} />
          </TimelineMonth>

          <TimelineMonth month="December" count="2 Deadlines">
            <TLCard iconColor="var(--primary)" icon="biotech" name="MIT Engineering" program="Regular Action" deadline="Dec 15, 2025" deadlineColor="#94a3b8" extra={{ icon: 'info', text: 'Requires Interview', color: 'var(--primary)' }} />
            <TLCard iconColor="var(--primary)" icon="computer" name="ETH Zurich" program="MSc in Data Science" deadline="Dec 01, 2025" deadlineColor="#ea580c" extra={{ icon: 'warning', text: 'Action required', color: '#ea580c' }} />
          </TimelineMonth>

          <TimelineMonth month="January" count="1 Deadline">
            <TLCard iconColor="var(--primary)" icon="public" name="Oxford University" program="Graduate Admissions" deadline="Jan 10, 2026" deadlineColor="#94a3b8" extra={{ icon: 'schedule', text: 'Plenty of time', color: 'var(--tertiary)' }} />
          </TimelineMonth>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ProgressCard />
          <AIStrategyCard />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <QuickTool icon="add_task" label="New Task" />
            <QuickTool icon="share" label="Sync Cal" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineMonth({ month, count, active, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 64, paddingLeft: 32, borderLeft: '2px dashed #e2e8f0' }}>
      <div style={{ position: 'absolute', left: -9, top: 0, width: 16, height: 16, borderRadius: '50%', background: active ? 'var(--primary)' : '#e2e8f0', boxShadow: '0 0 0 4px #f7f9ff' }}></div>
      <h4 className="t-headline-md" style={{ margin: '0 0 24px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 12 }}>
        {month}
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', background: '#f1f5f9', color: '#64748b', borderRadius: 999 }}>{count}</span>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  );
}

function TLCard({ icon, iconColor, name, program, deadline, deadlineColor, extra }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', padding: 20, borderRadius: 24, border: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer',
        boxShadow: hover ? '0 6px 20px rgba(15,23,42,0.08)' : '0 2px 8px rgba(15,23,42,0.04)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: 'var(--surface-container-high)',
          display: 'grid', placeItems: 'center', color: iconColor,
          transform: hover ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.25s',
        }}>
          <Icon name={icon} style={{ fontSize: 28 }} />
        </div>
        <div>
          <h5 style={{ margin: '0 0 3px', fontSize: 18, fontWeight: 700 }}>{name}</h5>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>{program}</p>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: deadlineColor, letterSpacing: '0.02em' }}>
              <Icon name="alarm" style={{ fontSize: 14 }} /> {deadline}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: extra.color, letterSpacing: '0.02em' }}>
              <Icon name={extra.icon} style={{ fontSize: 14 }} /> {extra.text}
            </span>
          </div>
        </div>
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        background: hover ? 'var(--primary-container)' : 'transparent',
        border: hover ? '2px solid var(--primary-container)' : '2px solid #f1f5f9',
        color: hover ? '#fff' : '#cbd5e1',
        display: 'grid', placeItems: 'center', transition: 'all 0.2s',
      }}>
        <Icon name="chevron_right" style={{ fontSize: 22 }} />
      </div>
    </div>
  );
}

function ProgressCard() {
  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 32, border: '1px solid #e2e8f0' }}>
      <h4 className="t-headline-md" style={{ margin: '0 0 20px' }}>Cycle Progress</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ padding: '4px 10px', background: 'rgba(83,250,194,0.15)', color: 'var(--on-secondary-container)', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tasks Completed</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--secondary)' }}>65%</span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, var(--secondary), var(--secondary-fixed-dim))', transition: 'width 0.6s ease' }}></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: 14, background: 'var(--surface-container)', borderRadius: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>12</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>Tasks Left</div>
        </div>
        <div style={{ padding: 14, background: 'var(--surface-container)', borderRadius: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>08</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>Days to Next</div>
        </div>
      </div>
    </div>
  );
}

function AIStrategyCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.5)', padding: 24, borderRadius: 32, border: '1px solid rgba(255,255,255,0.7)', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, background: 'rgba(0,163,255,0.2)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'var(--primary-container)', color: '#fff', padding: 8, borderRadius: 10 }}>
          <Icon name="smart_toy" fill style={{ fontSize: 20 }} />
        </div>
        <h4 className="t-headline-md" style={{ margin: 0 }}>AI Strategy</h4>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--on-surface-variant)', lineHeight: 1.55, position: 'relative', zIndex: 1 }}>
        Prioritize your "Personal Statement" for Princeton. Your writing velocity is higher on weekends — aim for 400 words Saturday.
      </p>
      <button style={{
        width: '100%', padding: '12px 16px', background: '#fff', border: '2px solid rgba(0,163,255,0.3)',
        color: 'var(--primary)', fontWeight: 800, fontSize: 13, borderRadius: 12, cursor: 'pointer',
        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 3px 0 0 rgba(0,163,255,0.15)', position: 'relative', zIndex: 1,
      }}>
        View Plan <Icon name="bolt" style={{ fontSize: 16 }} />
      </button>
    </div>
  );
}

function QuickTool({ icon, label }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', border: `1px solid ${hover ? 'var(--primary-container)' : '#e2e8f0'}`,
        borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: hover ? '0 4px 12px rgba(0,163,255,0.12)' : 'none',
        transition: 'all 0.2s',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: hover ? 'rgba(0,163,255,0.1)' : '#f8fafc',
        color: hover ? 'var(--primary)' : '#94a3b8',
        display: 'grid', placeItems: 'center', transition: 'all 0.2s',
      }}>
        <Icon name={icon} style={{ fontSize: 22 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{label}</span>
    </button>
  );
}

window.Timeline = Timeline;
