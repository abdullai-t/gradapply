// Tactile Fusion — Documents Library (matches reference)

function Documents() {
  return (
    <div className="slide-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 className="t-headline-lg" style={{ margin: '0 0 6px' }}>Documents Library</h2>
          <p style={{ margin: 0, color: 'var(--on-surface-variant)', fontSize: 15 }}>Manage and organize your academic portfolio</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)', fontSize: 20 }} />
            <input placeholder="Search files..." style={{
              padding: '12px 16px 12px 40px', background: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)', borderRadius: 12, fontSize: 14,
              fontFamily: 'inherit', outline: 'none', width: 256,
            }} />
          </div>
          <TacButton icon="cloud_upload">Upload New</TacButton>
        </div>
      </div>

      {/* Top row: storage health + quick access */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 40 }}>
        <StorageHealth />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Quick Access</h4>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>View all</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <QuickAccess icon="picture_as_pdf" tint="#fef2f2" tintFg="#ef4444" name="Official_Transcript_2023.pdf" meta="Uploaded 2h ago • 1.2MB" />
            <QuickAccess icon="description" tint="#eff6ff" tintFg="#3b82f6" name="Statement_of_Purpose.docx" meta="Uploaded yesterday • 45KB" />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ marginBottom: 40 }}>
        <h4 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Categories</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <FolderCard icon="folder" title="Academic" count="12 files" accent="var(--primary)" />
          <FolderCard icon="account_box" title="Identity" count="4 files" accent="var(--secondary)" />
          <FolderCard icon="emoji_events" title="Certificates" count="8 files" accent="var(--tertiary-container)" />
          <FolderCard icon="history_edu" title="Reference" count="3 files" accent="var(--error)" />
          <AddFolderCard />
        </div>
      </div>

      {/* Detailed list */}
      <AllDocumentsTable />
    </div>
  );
}

function StorageHealth() {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--outline-variant)', borderRadius: 16,
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -16, bottom: -20, opacity: 0.05, pointerEvents: 'none' }}>
        <Icon name="folder_shared" style={{ fontSize: 120 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, position: 'relative', zIndex: 1 }}>
        <div style={{ padding: 12, background: 'var(--primary-fixed)', color: 'var(--on-primary-container)', borderRadius: 12 }}>
          <Icon name="database" style={{ fontSize: 22 }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface-variant)', letterSpacing: '0.02em' }}>72% Full</span>
      </div>
      <h3 className="t-headline-md" style={{ margin: '0 0 10px', position: 'relative', zIndex: 1 }}>Storage Health</h3>
      <div style={{ width: '100%', height: 10, background: 'var(--surface-container)', borderRadius: 999, overflow: 'hidden', marginBottom: 14, position: 'relative', zIndex: 1 }}>
        <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--primary-container))', borderRadius: 999, transition: 'width 0.6s ease' }}></div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--on-surface-variant)', position: 'relative', zIndex: 1 }}>Using 3.6 GB of 5.0 GB total storage.</p>
    </div>
  );
}

function QuickAccess({ icon, tint, tintFg, name, meta }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', border: `1px solid ${hover ? 'var(--primary)' : 'var(--outline-variant)'}`,
        borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: tint, color: tintFg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} style={{ fontSize: 24 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--on-surface-variant)' }}>{meta}</p>
      </div>
      <Icon name="arrow_forward" style={{ color: hover ? 'var(--primary)' : 'var(--outline)', fontSize: 20, transition: 'color 0.2s' }} />
    </div>
  );
}

function FolderCard({ icon, title, count, accent }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--surface-container-low)' : '#fff',
        border: '1px solid var(--outline-variant)',
        borderBottom: `4px solid ${accent}`, borderRadius: 14, padding: 20,
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
      <Icon name={icon} fill style={{ color: accent, fontSize: 36, marginBottom: 12 }} />
      <h5 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h5>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--on-surface-variant)' }}>{count}</p>
    </div>
  );
}

function AddFolderCard() {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        border: '2px dashed var(--outline-variant)', borderRadius: 14,
        background: hover ? '#fff' : 'transparent',
        padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.2s', gap: 8,
      }}>
      <Icon name="add_circle" style={{ color: hover ? 'var(--primary)' : 'var(--outline)', fontSize: 28, transition: 'color 0.2s' }} />
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: hover ? 'var(--primary)' : 'var(--outline)', transition: 'color 0.2s' }}>Add Folder</p>
    </div>
  );
}

function AllDocumentsTable() {
  const rows = [
    { icon: 'picture_as_pdf', tint: '#fef2f2', tintFg: '#ef4444', name: 'IELTS_Academic_Result.pdf', status: 'verified', date: 'Oct 12, 2023', size: '1.4 MB' },
    { icon: 'image', tint: '#eff6ff', tintFg: '#3b82f6', name: 'Passport_Scan_Copy.jpg', status: 'pending', date: 'Oct 14, 2023', size: '3.2 MB' },
    { icon: 'description', tint: '#fff7ed', tintFg: '#f97316', name: 'Scholarship_Essay_V1.docx', status: 'expired', date: 'Sep 28, 2023', size: '840 KB' },
    { icon: 'school', tint: '#faf5ff', tintFg: '#a855f7', name: 'Graduation_Certificate.pdf', status: 'verified', date: 'Oct 01, 2023', size: '2.1 MB' },
  ];
  return (
    <div style={{ background: '#fff', border: '1px solid var(--outline-variant)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
      <div style={{
        padding: 24, borderBottom: '1px solid var(--outline-variant)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--surface-container-lowest)',
      }}>
        <h4 className="t-headline-md" style={{ margin: 0 }}>All Documents</h4>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--outline)', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
            <Icon name="filter_list" style={{ fontSize: 20 }} />
          </button>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--outline)', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
            <Icon name="sort" style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-container-low)' }}>
            {['Name', 'Status', 'Date Uploaded', 'Size', ''].map((h, i) => (
              <th key={h + i} style={{
                padding: '14px 24px', textAlign: i === 4 ? 'right' : 'left',
                fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <DocumentRow key={i} {...r} />)}
        </tbody>
      </table>
      <div style={{
        padding: 14, background: 'var(--surface-container-low)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-surface-variant)' }}>Showing 1 to 4 of 27 documents</p>
        <div style={{ display: 'flex', gap: 4 }}>
          <button disabled style={{ padding: 8, border: '1px solid var(--outline-variant)', borderRadius: 8, background: '#fff', opacity: 0.5, cursor: 'not-allowed' }}>
            <Icon name="chevron_left" style={{ fontSize: 16 }} />
          </button>
          <button style={{ padding: 8, border: '1px solid var(--outline-variant)', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
            <Icon name="chevron_right" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({ icon, tint, tintFg, name, status, date, size }) {
  const [hover, setHover] = React.useState(false);
  const statusMap = {
    verified: { icon: 'verified', label: 'Verified', bg: 'var(--secondary-container)', fg: 'var(--on-secondary-container)' },
    pending: { icon: 'schedule', label: 'Pending', bg: 'var(--surface-container-highest)', fg: 'var(--on-surface-variant)' },
    expired: { icon: 'report', label: 'Expired', bg: 'var(--error-container)', fg: 'var(--on-error-container)' },
  };
  const s = statusMap[status];
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderTop: '1px solid var(--outline-variant)',
        background: hover ? 'var(--surface-container-low)' : 'transparent',
        transition: 'background 0.15s',
      }}>
      <td style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: tint, color: tintFg, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
            <Icon name={icon} style={{ fontSize: 18 }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
        </div>
      </td>
      <td style={{ padding: '18px 24px' }}>
        <span style={{
          padding: '4px 12px', background: s.bg, color: s.fg,
          fontSize: 11, fontWeight: 800, borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name={s.icon} style={{ fontSize: 13 }} /> {s.label}
        </span>
      </td>
      <td style={{ padding: '18px 24px', fontSize: 13, color: 'var(--on-surface-variant)' }}>{date}</td>
      <td style={{ padding: '18px 24px', fontSize: 13, color: 'var(--on-surface-variant)' }}>{size}</td>
      <td style={{ padding: '18px 24px', textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--outline)', borderRadius: 8, cursor: 'pointer' }}>
            <Icon name="visibility" style={{ fontSize: 18 }} />
          </button>
          <button style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--outline)', borderRadius: 8, cursor: 'pointer' }}>
            <Icon name="more_vert" style={{ fontSize: 18 }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

window.Documents = Documents;
