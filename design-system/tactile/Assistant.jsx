// Tactile Fusion — AI Assistant (matches reference with agent chips, chat, stats panel)

function Assistant() {
  const [agent, setAgent] = React.useState('General');
  return (
    <div className="slide-in" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, minHeight: 'calc(100vh - 160px)' }}>
      {/* Chat column */}
      <div style={{ background: 'var(--surface-container-low)', borderRadius: 24, border: '1px solid var(--outline-variant)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Agent selector bar */}
        <div style={{ padding: 16, background: '#fff', borderBottom: '1px solid var(--surface-container)', display: 'flex', gap: 10, overflowX: 'auto' }}>
          {[
            { n: 'General', i: 'smart_toy' },
            { n: 'Grammar', i: 'spellcheck' },
            { n: 'SOP Editor', i: 'edit_note' },
            { n: 'Research', i: 'biotech' },
          ].map(a => {
            const active = agent === a.n;
            return (
              <button key={a.n} onClick={() => setAgent(a.n)} style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 999,
                background: active ? 'var(--primary-container)' : 'var(--surface)',
                color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                border: active ? 'none' : '1px solid var(--outline-variant)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 2px 0 0 rgba(0,98,157,0.25)' : 'none',
                transition: 'all 0.15s',
              }}>
                <Icon name={a.i} fill={active} style={{ fontSize: 18 }} /> {a.n}
              </button>
            );
          })}
        </div>

        {/* Conversation */}
        <div style={{
          flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto',
          backgroundImage: 'radial-gradient(circle, rgba(207,229,255,0.4) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}>
          <AIBubble text="Hello! I'm your ScholarQuest academic assistant. I've analyzed your Statement of Purpose draft. Would you like to focus on the structure, or should we dive into the grammar and vocabulary refinements first?" time="10:24 AM" />
          <UserBubble text="Let's look at the structure. I'm worried the transition between my volunteer work and my career goals feels a bit abrupt. Can you suggest a better bridge?" time="10:25 AM" />
          <AIBubble time="10:26 AM" chips={['Apply change', 'Show alternatives']}>
            <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.6 }}>I see what you mean. Here is a suggested bridge that connects the empathy learned in volunteering with your data-driven career objectives:</p>
            <div style={{
              background: 'var(--surface)', padding: '14px 16px', borderRadius: 10,
              borderLeft: '4px solid #f59e0b', fontStyle: 'italic',
              fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.55,
            }}>
              "While my time at the community center solidified my commitment to social impact, it simultaneously highlighted a systemic need for the quantitative analysis skills I now seek to master..."
            </div>
          </AIBubble>
        </div>

        {/* Composer */}
        <div style={{ padding: 20, background: '#fff', borderTop: '1px solid var(--surface-container)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', borderRadius: 999,
            border: '2px solid var(--outline-variant)', padding: 6,
            transition: 'border-color 0.2s',
          }}>
            <button style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--outline)', cursor: 'pointer', borderRadius: '50%' }}>
              <Icon name="attach_file" style={{ fontSize: 20 }} />
            </button>
            <input placeholder="Type your message here..." style={{
              flex: 1, background: 'transparent', border: 'none', padding: '8px 6px',
              fontSize: 15, fontFamily: 'inherit', outline: 'none',
            }} />
            <button style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'var(--primary)', color: '#fff', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 4px 0 0 #004a77', transition: 'transform 0.1s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
            onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <Icon name="send" fill style={{ fontSize: 20 }} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px 0' }}>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--outline)', fontWeight: 600 }}>ScholarQuest AI v4.2 • Academic Mode</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--outline)', fontWeight: 600 }}>842 words remaining this month</p>
          </div>
        </div>
      </div>

      {/* Writing Stats aside */}
      <aside style={{ background: '#fff', borderRadius: 24, border: '1px solid var(--outline-variant)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Writing Statistics</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StatTile icon="menu_book" label="Readability Score" value="82" delta="+5" hint="Ideal for graduate applications" progress={82} bar="var(--primary-container)" />
          <StatTile icon="psychology" label="Tone Consistency" hint="Strong academic authority maintained" progress={94} bar="var(--tertiary-container)"
            customValue={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '3px 8px', background: '#fef3c7', color: '#b45309', borderRadius: 6, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Professional</span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>94%</span>
              </div>
            )} />
          <LexicalDensityCard />
        </div>

        {/* Optimization Tips */}
        <div>
          <h4 style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Optimization Tips</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Tip icon="warning" tint="var(--error-container)" tintFg="var(--error)" title="Passive Voice Detected" body="3 instances in paragraph 2 could be more impactful if changed to active voice." />
            <Tip icon="check_circle" tint="var(--tertiary-fixed)" tintFg="var(--on-tertiary-container)" title="Great Word Choice" body={<>"Systemic need" is an excellent academic phrase for this context.</>} />
          </div>
        </div>

        {/* Doc preview */}
        <div style={{
          marginTop: 'auto', padding: 16, background: 'var(--primary)', color: '#fff',
          borderRadius: 16, boxShadow: '0 10px 24px -8px rgba(0,98,157,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Icon name="description" style={{ fontSize: 20 }} />
            <span style={{ fontSize: 12, fontWeight: 800 }}>SOP_Draft_V2.pdf</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 999, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '75%', background: '#fff', borderRadius: 999 }}></div>
          </div>
          <button style={{
            width: '100%', background: '#fff', color: 'var(--primary)',
            border: 'none', padding: '8px', borderRadius: 999,
            fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}>Export Report</button>
        </div>
      </aside>
    </div>
  );
}

function AIBubble({ text, children, time, chips }) {
  return (
    <div style={{ display: 'flex', gap: 14, maxWidth: 640 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'var(--primary)', display: 'grid', placeItems: 'center',
        boxShadow: '0 6px 16px -4px rgba(0,98,157,0.4)',
      }}>
        <Icon name="auto_awesome" fill style={{ color: '#fff', fontSize: 22 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          background: '#fff', padding: 20, borderRadius: 16,
          borderBottomLeftRadius: 4, border: '1px solid var(--outline-variant)',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          color: 'var(--on-surface)', lineHeight: 1.6,
        }}>
          {text ? <p style={{ margin: 0, fontSize: 15 }}>{text}</p> : children}
        </div>
        {chips && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map((c, i) => (
              <button key={c} style={{
                background: '#fff',
                border: i === 0 ? '1px solid var(--primary)' : '1px solid var(--outline)',
                color: i === 0 ? 'var(--primary)' : 'var(--outline)',
                padding: '5px 14px', borderRadius: 999,
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>{c}</button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 10, color: 'var(--outline)', padding: '0 4px' }}>ScholarQuest Assistant • {time}</span>
      </div>
    </div>
  );
}

function UserBubble({ text, time }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #cfe5ff, #98cbff)',
        border: '2px solid var(--primary-container)', display: 'grid', placeItems: 'center',
        fontWeight: 900, fontSize: 14, color: 'var(--primary)',
      }}>AT</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: 640 }}>
        <div style={{
          background: 'var(--primary-container)', color: 'var(--on-primary-container)',
          padding: 20, borderRadius: 16, borderBottomRightRadius: 4,
          boxShadow: '0 4px 12px rgba(0,163,255,0.15)',
          fontSize: 15, lineHeight: 1.6,
        }}>
          <p style={{ margin: 0 }}>{text}</p>
        </div>
        <span style={{ fontSize: 10, color: 'var(--outline)', padding: '0 4px' }}>You • {time}</span>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, delta, hint, progress, bar, customValue }) {
  return (
    <div style={{
      padding: 18, background: 'var(--surface-container-low)',
      borderRadius: 14, border: '1px solid var(--outline-variant)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.1 }}>
        <Icon name={icon} style={{ fontSize: 40 }} />
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {customValue || (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>{value}</span>
          {delta && (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--tertiary)', display: 'inline-flex', alignItems: 'center', paddingBottom: 4 }}>
              <Icon name="arrow_upward" style={{ fontSize: 14 }} /> {delta}
            </span>
          )}
        </div>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--outline-variant)', fontWeight: 500 }}>{hint}</p>
      <div style={{ marginTop: 12, height: 6, background: 'var(--surface-container-highest)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: bar, borderRadius: 999, transition: 'width 0.6s' }}></div>
      </div>
    </div>
  );
}

function LexicalDensityCard() {
  return (
    <div style={{
      padding: 18, background: 'var(--surface-container-low)',
      borderRadius: 14, border: '1px solid var(--outline-variant)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lexical Density</p>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>High</p>
        <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--outline)' }}>Excellent vocabulary</p>
      </div>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r="28" fill="transparent" stroke="var(--surface-container-highest)" strokeWidth="6" />
          <circle cx="32" cy="32" r="28" fill="transparent" stroke="var(--secondary-container)" strokeWidth="6"
            strokeDasharray="176" strokeDashoffset="44" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>75%</div>
      </div>
    </div>
  );
}

function Tip({ icon, tint, tintFg, title, body }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: tint, color: tintFg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} style={{ fontSize: 16 }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--outline)', lineHeight: 1.45 }}>{body}</p>
      </div>
    </div>
  );
}

window.Assistant = Assistant;
