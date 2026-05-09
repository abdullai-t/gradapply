// Tactile Fusion — Profile & Settings only (Documents/Assistant now in own files)

// ============ PROFILE ============
function Profile() {
  return (
    <div className="slide-in">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--outline-variant)', padding: 32, display: 'flex', gap: 28, alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--primary-container), var(--secondary-container))' }}></div>
          <div style={{ width: 120, height: 120, borderRadius: 24, background: 'linear-gradient(135deg, #cfe5ff, #98cbff)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 40, fontWeight: 900, color: 'var(--primary)', border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>AT</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 className="t-headline-lg" style={{ margin: '0 0 4px' }}>Alex Thorne</h3>
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                  <Icon name="verified" fill style={{ fontSize: 16 }} /> Prospective PhD Candidate
                </p>
              </div>
              <TacButton variant="secondary" icon="edit">Edit Bio</TacButton>
            </div>
            <p style={{ margin: '14px 0 20px', color: 'var(--on-surface-variant)', fontSize: 15, lineHeight: 1.6 }}>
              Aspiring researcher at the intersection of AI and human cognitive neuroscience. Seeking programs that bridge computational modeling and clinical application.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[{ i: 'location_on', t: 'Stanford, CA' }, { i: 'school', t: 'BS Computer Science' }, { i: 'work', t: 'OpenLabs Intern' }].map(c => (
                <span key={c.t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface-container)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--on-surface-variant)' }}>
                  <Icon name={c.i} style={{ fontSize: 14 }} /> {c.t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--outline-variant)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h4 className="t-headline-md" style={{ margin: 0 }}>Academic Stats</h4>
            <Icon name="analytics" style={{ color: 'var(--primary)', fontSize: 20 }} />
          </div>
          <div style={{ padding: 16, background: 'var(--surface-container-low)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Cumulative GPA</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>3.92<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--outline)' }}>/4.0</span></div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--on-secondary-container)', borderRightColor: 'transparent', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, color: 'var(--on-secondary-container)' }}>98%</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 14, background: 'var(--surface-container-low)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>GRE Quant</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>168</div>
            </div>
            <div style={{ padding: 14, background: 'var(--surface-container-low)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>GRE Verbal</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>164</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--outline-variant)', padding: 20 }}>
          <h4 className="t-headline-md" style={{ margin: '0 0 20px' }}>Research Focus</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Neural Networks', 'Cognitive Modeling', 'Bio-informatics', 'NLP', 'Ethical AI'].map(t => (
              <span key={t} style={{ padding: '6px 12px', background: 'rgba(83,250,194,0.15)', color: 'var(--on-secondary-container)', border: '1px solid rgba(83,250,194,0.3)', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{t}</span>
            ))}
            <button style={{ padding: '6px 12px', border: '2px dashed var(--outline-variant)', background: 'transparent', color: 'var(--outline)', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Interest</button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--outline-variant)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h4 className="t-headline-md" style={{ margin: 0 }}>Application Timeline</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--tertiary-container)' }}></span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--on-surface-variant)' }}>Ahead of Schedule</span>
            </div>
          </div>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--surface-container)' }}></div>
            <div style={{ position: 'absolute', left: 7, top: 8, height: '50%', width: 2, background: 'var(--primary-container)' }}></div>
            {[
              { s: 'COMPLETED • SEP 15', t: 'University Shortlisting', done: true },
              { s: 'COMPLETED • OCT 02', t: 'Statement of Purpose Draft 1', done: true },
              { s: 'IN PROGRESS • OCT 25', t: 'LOR Requests', done: false },
              { s: 'UPCOMING • NOV 15', t: 'GRE Official Score Reporting', done: false },
            ].map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, position: 'relative' }}>
                <div style={{ position: 'absolute', left: -28, width: 16, height: 16, borderRadius: 999, background: it.done ? 'var(--primary-container)' : 'var(--surface-container-highest)', border: '3px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></div>
                <div style={{ flex: 1, padding: 12, background: it.done ? 'var(--surface-container-low)' : '#fff', border: `1px solid ${it.done ? 'transparent' : 'var(--surface-container)'}`, borderLeft: `4px solid ${it.done ? 'var(--primary-container)' : 'var(--surface-container-highest)'}`, borderRadius: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, color: it.done ? 'var(--primary)' : 'var(--outline)', letterSpacing: '0.05em' }}>{it.s}</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{it.t}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, var(--primary), #1e40af)', color: '#fff', borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, bottom: -40, opacity: 0.12 }}>
            <Icon name="smart_toy" style={{ fontSize: 160 }} />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center' }}>
                <Icon name="bolt" fill style={{ fontSize: 18 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em' }}>AI ADVISOR TIP</span>
            </div>
            <h5 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>Boost Your Statement of Purpose</h5>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(224,242,254,0.85)', lineHeight: 1.55 }}>
              Highlight your 2025 Bio-informatics project — it specifically appeals to Stanford's interdisciplinary board.
            </p>
            <button style={{ width: '100%', background: '#fff', color: 'var(--primary)', border: 'none', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Apply Tip to Draft</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SETTINGS ============
function Settings() {
  return (
    <div className="slide-in" style={{ maxWidth: 800 }}>
      <h2 className="t-headline-lg" style={{ margin: '0 0 8px' }}>Settings</h2>
      <p style={{ margin: '0 0 32px', color: 'var(--on-surface-variant)', fontSize: 15 }}>Preferences and account controls.</p>

      <SettingsSection title="Account" items={[
        { i: 'person', l: 'Profile information', sub: 'Name, photo, contact details' },
        { i: 'lock', l: 'Password & security', sub: 'Two-factor, trusted devices' },
        { i: 'mail', l: 'Email preferences', sub: 'alex.thorne@globaltech.edu' },
      ]} />
      <SettingsSection title="Preferences" items={[
        { i: 'palette', l: 'Appearance', sub: 'Light (currently)', toggle: false },
        { i: 'local_fire_department', l: 'Streak reminders', sub: 'Daily at 6:00 PM', toggle: true },
        { i: 'notifications', l: 'Push notifications', sub: 'Deadlines, messages', toggle: true },
        { i: 'language', l: 'Language', sub: 'English (US)' },
      ]} />
      <SettingsSection title="Integrations" items={[
        { i: 'calendar_month', l: 'Google Calendar', sub: 'Connected', connected: true },
        { i: 'description', l: 'Google Drive', sub: 'Connected', connected: true },
        { i: 'forum', l: 'Slack advisor channel', sub: 'Not connected' },
      ]} />
      <SettingsSection title="Danger zone" danger items={[
        { i: 'download', l: 'Export all data', sub: 'Download a ZIP of everything' },
        { i: 'delete', l: 'Delete account', sub: 'Permanently erase your data', danger: true },
      ]} />
    </div>
  );
}

function SettingsSection({ title, items, danger }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: danger ? 'var(--error)' : 'var(--on-surface-variant)' }}>{title}</h3>
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${danger ? '#fecaca' : 'var(--outline-variant)'}`, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={it.l} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
            borderBottom: i < items.length - 1 ? '1px solid var(--surface-container)' : 'none',
            cursor: 'pointer',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: it.danger ? '#fee2e2' : 'var(--surface-container)', color: it.danger ? 'var(--error)' : 'var(--on-surface-variant)', display: 'grid', placeItems: 'center' }}>
              <Icon name={it.i} style={{ fontSize: 20 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: it.danger ? 'var(--error)' : 'var(--on-surface)' }}>{it.l}</div>
              <div style={{ fontSize: 12, color: 'var(--outline)' }}>{it.sub}</div>
            </div>
            {it.toggle !== undefined ? (
              <div style={{ width: 44, height: 24, borderRadius: 999, background: it.toggle ? 'var(--primary)' : 'var(--surface-container-highest)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: it.toggle ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }}></div>
              </div>
            ) : it.connected ? (
              <span style={{ padding: '4px 10px', background: 'rgba(43,108,0,0.1)', color: 'var(--tertiary)', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>Connected</span>
            ) : (
              <Icon name="chevron_right" style={{ color: 'var(--outline-variant)', fontSize: 20 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Profile, Settings });
