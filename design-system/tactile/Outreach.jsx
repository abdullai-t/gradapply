// Tactile Fusion — Outreach (Drafting Studio)
// Email threads sidebar, strategy option cards, email draft editor

function Outreach() {
  const [selected, setSelected] = React.useState(0);
  return (
    <div className="slide-in" style={{ display: 'flex', gap: 24 }}>
      {/* Threads sidebar */}
      <aside style={{ width: 320, flexShrink: 0 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.03)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', background: 'var(--surface-container-low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Email Threads</h3>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 4 }}>
              <Icon name="add_circle" style={{ fontSize: 18 }} />
            </button>
          </div>
          {[
            { name: 'Dr. Sarah Chen', subject: 'Re: Stanford Robotics Lab', time: '10:45 AM', tag: 'ACTIVE DRAFT', tagBg: 'rgba(83,250,194,0.2)', tagFg: 'var(--on-secondary-container)' },
            { name: 'Prof. Marcus Thorne', subject: 'Quantum Materials Synthesis', time: 'Yesterday', tag: 'SENT', tagBg: '#f1f5f9', tagFg: '#64748b' },
            { name: 'Dr. Elena Rodriguez', subject: 'RE: Summer Intern Opportunities', time: 'Oct 12', tag: 'ACCEPTED', tagBg: 'rgba(43,108,0,0.1)', tagFg: 'var(--on-tertiary-container)' },
            { name: 'Prof. Ana Volkov', subject: 'PhD positions — robotics', time: 'Oct 08', tag: 'REPLIED', tagBg: '#eff6ff', tagFg: 'var(--primary)' },
          ].map((t, i) => (
            <div key={i} onClick={() => setSelected(i)} style={{
              padding: 16, borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
              background: selected === i ? 'rgba(0,98,157,0.05)' : '#fff',
              borderLeft: selected === i ? '4px solid var(--primary)' : '4px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{t.time}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: selected === i ? '#475569' : '#94a3b8', fontWeight: selected === i ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
              <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, background: t.tagBg, color: t.tagFg, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em' }}>{t.tag}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Studio */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 className="t-headline-lg" style={{ margin: '0 0 6px' }}>Drafting Studio</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>Refining your outreach to <strong style={{ color: 'var(--primary)' }}>Dr. Sarah Chen</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <TacButton variant="secondary" icon="save">Save Draft</TacButton>
            <TacButton icon="send">Send Outreach</TacButton>
          </div>
        </div>

        {/* Strategy options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <StrategyCard active icon="science" label="Option 1" title="Research Enthusiast" body="Focuses on their recent publications in Neural-Symbolic Integration to show deep subject mastery." tint="var(--primary)" />
          <StrategyCard icon="groups" label="Option 2" title="Lab Culture Focus" body="Emphasizes how your skills align with their lab's workflow and collaborative environment." tint="var(--tertiary)" />
        </div>

        {/* Draft editor */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 30px -10px rgba(15,23,42,0.08)' }}>
          <div style={{ background: 'var(--surface-container-low)', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f87171' }}></span>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#facc15' }}></span>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ade80' }}></span>
              </div>
              <span style={{ height: 16, width: 1, background: '#cbd5e1' }}></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                <Icon name="edit_note" style={{ fontSize: 18 }} /> Draft_v2_Chen.eml
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ background: 'transparent', border: 'none', padding: 6, borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}><Icon name="history" style={{ fontSize: 18 }} /></button>
              <button style={{ background: 'transparent', border: 'none', padding: 6, borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}><Icon name="more_vert" style={{ fontSize: 18 }} /></button>
            </div>
          </div>
          <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid #f1f5f9', marginBottom: 20 }}>
              <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, width: 80, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Subject</span>
              <span style={{ color: '#334155', fontWeight: 800, fontSize: 15 }}>Inquiry regarding Neural-Symbolic Integration Research — Alex Thorne</span>
            </div>
            <div style={{ color: '#334155', lineHeight: 1.65, fontSize: 16 }}>
              <p style={{ margin: '0 0 14px' }}>Dear Dr. Chen,</p>
              <p style={{ margin: '0 0 14px' }}>
                I recently read your paper on <span style={{ background: 'rgba(83,250,194,0.3)', padding: '1px 6px', borderRadius: 4 }}>"Cross-Domain Generalization in Autonomous Agents"</span> in Nature Machine Intelligence. The way you bridged symbolic logic and deep learning — especially the neuro-symbolic stack implementation — is remarkable.
              </p>
              <div style={{ margin: '0 0 14px', fontStyle: 'italic', color: '#64748b', borderLeft: '4px solid #bfdbfe', paddingLeft: 14, background: 'rgba(239,246,255,0.4)', padding: '10px 14px', borderRadius: 4 }}>
                <strong style={{ color: 'var(--primary)', fontStyle: 'normal' }}>AI Tip:</strong> You might mention your specific Python implementation of similar logic here to demonstrate technical capability.
              </div>
              <p style={{ margin: '0 0 14px' }}>
                I'm a senior CS student at Global Tech with a focused interest in AI-safety and symbolic reasoning. After two internships at OpenLabs on Project Orion, I'm eager to contribute to the next phase of your lab's research this summer.
              </p>
              <p style={{ margin: '0 0 14px' }}>
                Would you be available for a 10-minute call next Wednesday or Thursday to discuss research opportunities and learn more about the lab's current direction?
              </p>
              <p style={{ margin: '0 0 14px' }}>Thank you for your time and the inspiring work you contribute to the field.</p>
              <p style={{ margin: '0 0 4px' }}>Best regards,</p>
              <p style={{ margin: 0, fontWeight: 800 }}>Alex Thorne</p>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '14px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['format_bold', 'format_italic', 'link', 'attach_file'].map(i => (
                <button key={i} style={{ padding: 8, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 8 }}>
                  <Icon name={i} style={{ fontSize: 18 }} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex' }}>
                {['#fecaca', '#bfdbfe', '#bbf7d0'].map((c, i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid #fff', marginLeft: i ? -8 : 0 }}></div>
                ))}
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', border: '2px solid #fff', marginLeft: -8, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, color: '#64748b' }}>+3</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>3 advisors reviewed this</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({ active, icon, label, title, body, tint }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', padding: 24, borderRadius: 20,
        border: active ? `2px solid ${tint}` : '1px solid #e2e8f0',
        boxShadow: active ? '0 6px 0 0 #e2e8f0' : hover ? '0 6px 0 0 #e2e8f0' : '0 6px 0 0 #f1f5f9',
        transform: (active || hover) ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
      }}>
      {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: tint }}></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ background: `color-mix(in oklab, ${tint} 10%, transparent)`, color: tint, padding: 8, borderRadius: 10 }}>
          <Icon name={icon} fill={active} style={{ fontSize: 20 }} />
        </div>
        <span style={{ padding: '4px 12px', background: active ? `color-mix(in oklab, ${tint} 10%, transparent)` : '#f1f5f9', color: active ? tint : '#94a3b8', fontSize: 10, fontWeight: 900, borderRadius: 999, letterSpacing: '0.1em' }}>{label}</span>
      </div>
      <h4 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{title}</h4>
      <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>{body}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: active ? tint : '#94a3b8', fontWeight: 800, fontSize: 13 }}>
        <span>{active ? 'Current strategy' : 'Select strategy'}</span>
        <Icon name="arrow_forward" style={{ fontSize: 16 }} />
      </div>
    </div>
  );
}

window.Outreach = Outreach;
