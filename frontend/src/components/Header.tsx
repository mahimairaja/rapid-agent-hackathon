interface HeaderProps {
  title: string;
  subtitle?: string;
  isDemoMode: boolean;
  onMenuClick: () => void;
  onLogout: () => void;
  userInitials: string;
}

export function Header({ title, subtitle, isDemoMode, onMenuClick, onLogout, userInitials }: HeaderProps) {
  return (
    <header className="header" role="banner">
      <div className="header-left">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="header-btn mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-haspopup="true"
          id="mobile-menu-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
      </div>

      <div className="header-actions">
        {isDemoMode && (
          <div className="demo-badge" title="Using synthetic demo data — no backend required" role="status">
            <span className="demo-badge-dot" aria-hidden="true" />
            Demo Mode
          </div>
        )}

        <button
          type="button"
          className="header-avatar"
          onClick={onLogout}
          title="Click to sign out"
          aria-label={`Signed in as ${userInitials} — click to sign out`}
          id="user-avatar-btn"
        >
          {userInitials}
        </button>
      </div>
    </header>
  );
}
