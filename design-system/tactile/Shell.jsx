// Tactile Fusion — app shell (sidebar, topbar, navigation)
// Used by all page components.

const NavContext = React.createContext({ route: 'dashboard', setRoute: () => {} });

function Icon({ name, fill = false, className = '', style = {} }) {
  return (
    <span className={"material-symbols-outlined " + className}
      style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400", ...style }}>
      {name}
    </span>
  );
}

function Sidebar() {
  const { route, setRoute } = React.useContext(NavContext);
  const items = [
    { k: 'dashboard', l: 'Dashboard', i: 'dashboard' },
    { k: 'schools', l: 'Schools', i: 'school' },
    { k: 'timeline', l: 'Timeline', i: 'timeline' },
    { k: 'outreach', l: 'Outreach', i: 'mail' },
    { k: 'documents', l: 'Documents', i: 'description' },
    { k: 'assistant', l: 'AI Assistant', i: 'smart_toy' },
  ];
  const footerItems = [
    { k: 'profile', l: 'Profile', i: 'account_circle' },
    { k: 'settings', l: 'Settings', i: 'settings' },
  ];

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 256, zIndex: 40,
      background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', padding: 16, gap: 4,
      boxShadow: '4px 0 24px -8px rgba(15,23,42,0.04)',
    }}>
      <div style={{ padding: '24px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-container), var(--primary))', display: 'grid', placeItems: 'center', boxShadow: '0 3px 0 0 #004a77' }}>
            <Icon name="auto_stories" fill style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: 16, letterSpacing: '-0.01em' }}>ScholarQuest</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Grad School Portal</div>
          </div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {items.map(it => <NavItem key={it.k} {...it} active={route === it.k} onClick={() => setRoute(it.k)} />)}
      </nav>

      <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {footerItems.map(it => <NavItem key={it.k} {...it} active={route === it.k} onClick={() => setRoute(it.k)} />)}
      </div>
    </aside>
  );
}

function NavItem({ l, i, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  if (active) {
    return (
      <a onClick={onClick}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 12,
          background: '#eff6ff', color: 'var(--primary)',
          borderBottom: '4px solid var(--primary)',
          boxShadow: '0 2px 0 0 var(--primary-container)',
          transform: 'translateY(-2px)',
          cursor: 'pointer', fontWeight: 700, fontSize: 14,
          textDecoration: 'none',
        }}>
        <Icon name={i} fill style={{ fontSize: 22 }} />
        <span>{l}</span>
      </a>
    );
  }
  return (
    <a onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 12,
        background: hover ? '#f1f5f9' : 'transparent',
        color: '#64748b',
        cursor: 'pointer', fontWeight: 600, fontSize: 14,
        transform: hover ? 'translateX(3px)' : 'translateX(0)',
        transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        textDecoration: 'none',
      }}>
      <Icon name={i} style={{ fontSize: 22 }} />
      <span>{l}</span>
    </a>
  );
}

function TopBar({ title, searchPlaceholder = 'Search...', streakDays = 12 }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(247,249,255,0.75)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(226,232,240,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 64,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
        <h2 className="t-headline-md" style={{ margin: 0, color: 'var(--on-surface)' }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 18 }} />
          <input placeholder={searchPlaceholder}
            style={{
              background: 'rgba(241,245,249,0.8)', border: 'none', borderRadius: 999,
              padding: '10px 16px 10px 38px', fontSize: 13, width: 260,
              fontFamily: 'inherit', color: 'var(--on-surface)',
            }} />
        </div>

        {/* Streak chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', background: '#fff7ed', borderRadius: 999,
          border: '2px solid #fed7aa', cursor: 'pointer',
        }}>
          <Icon name="local_fire_department" fill className="flame" style={{ fontSize: 18 }} />
          <span style={{ fontWeight: 800, fontSize: 12, color: '#c2410c', letterSpacing: '-0.01em' }}>{streakDays} Day Streak</span>
        </div>

        <button style={{
          width: 36, height: 36, borderRadius: 999, border: 'none', background: 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative', color: '#64748b',
        }}>
          <Icon name="notifications" style={{ fontSize: 20 }} />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, background: 'var(--error)', borderRadius: 999, border: '2px solid #f7f9ff' }}></span>
        </button>

        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: 'linear-gradient(135deg, #cfe5ff, #98cbff)',
          display: 'grid', placeItems: 'center', color: 'var(--primary)',
          fontWeight: 800, fontSize: 13, border: '2px solid #fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        }}>AT</div>
      </div>
    </header>
  );
}

function Page({ title, searchPlaceholder, children, fabIcon = 'smart_toy' }) {
  return (
    <>
      <Sidebar />
      <main style={{ marginLeft: 256, minHeight: '100vh' }}>
        <TopBar title={title} searchPlaceholder={searchPlaceholder} />
        <div style={{ padding: 32, maxWidth: 1240, margin: '0 auto' }}>
          {children}
        </div>
      </main>
      {fabIcon && <FAB icon={fabIcon} />}
    </>
  );
}

function FAB({ icon }) {
  return (
    <button style={{
      position: 'fixed', bottom: 32, right: 32, width: 60, height: 60, borderRadius: '50%',
      background: 'var(--primary)', color: '#fff', border: 'none',
      boxShadow: '0 6px 0 0 #004a77, 0 10px 30px -8px rgba(0,98,157,0.5)',
      display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 50,
      transition: 'all 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    onMouseDown={e => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = '0 2px 0 0 #004a77'; }}
    onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 0 0 #004a77, 0 10px 30px -8px rgba(0,98,157,0.5)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 0 0 #004a77, 0 10px 30px -8px rgba(0,98,157,0.5)'; }}>
      <Icon name={icon} fill style={{ fontSize: 26 }} />
    </button>
  );
}

// Tactile primary button
function TacButton({ children, variant = 'primary', icon, iconRight, onClick, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 20px', borderRadius: 12, border: 'none',
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };
  const variants = {
    primary: { background: 'var(--primary)', color: '#fff', boxShadow: '0 4px 0 0 #004a77' },
    secondary: { background: '#fff', color: 'var(--primary)', border: '2px solid var(--primary)', boxShadow: '0 3px 0 0 var(--primary)' },
    ghost: { background: 'transparent', color: 'var(--primary)', boxShadow: 'none' },
    danger: { background: 'var(--error)', color: '#fff', boxShadow: '0 4px 0 0 #7a0e0e' },
  };
  const [pressed, setPressed] = React.useState(false);
  const v = variants[variant];
  return (
    <button onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        ...base, ...v, ...style,
        transform: pressed ? 'translateY(3px)' : 'translateY(0)',
        boxShadow: pressed ? (v.boxShadow || '').replace('4px', '1px').replace('3px', '1px') : v.boxShadow,
      }}>
      {icon && <Icon name={icon} style={{ fontSize: 18 }} />}
      {children}
      {iconRight && <Icon name={iconRight} style={{ fontSize: 18 }} />}
    </button>
  );
}

Object.assign(window, { NavContext, Icon, Sidebar, TopBar, Page, FAB, TacButton });
