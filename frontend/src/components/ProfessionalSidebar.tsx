import type { ProfessionalAppView } from '../types'

interface ProfessionalSidebarProps {
  activeView: ProfessionalAppView
  onNavigate: (view: ProfessionalAppView) => void
  isOpen: boolean
  onClose: () => void
  providerName: string
  role: string
}

export function ProfessionalSidebar({
  activeView,
  onNavigate,
  isOpen,
  onClose,
  providerName,
  role,
}: ProfessionalSidebarProps) {
  const navItems: { id: ProfessionalAppView; label: string; icon: string; badge?: string }[] = [
    { id: 'patient-queue', label: 'Patient Queue', icon: '📋', badge: '3' },
    { id: 'patient-profile', label: 'Patient Profile', icon: '👤' },
    { id: 'escalation-center', label: 'Escalation Center', icon: '🚨', badge: '1' },
    { id: 'appointments', label: 'Appointments', icon: '📅' },
  ]

  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? ' active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar${isOpen ? ' open' : ''}`} aria-label="Provider navigation">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="logo-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-name">Rapid Recovery</span>
              <span className="logo-tagline">Provider Portal</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => {
                onNavigate(item.id)
                onClose()
              }}
            >
              <span className="sidebar-nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.badge && <span className={`badge ${item.id === 'escalation-center' ? 'badge-red' : 'badge-amber'}`} style={{ marginLeft: 'auto' }}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-patient">
          <div className="sidebar-patient-avatar" aria-hidden="true" style={{ background: 'var(--teal-500)', color: 'white' }}>
            {providerName.charAt(0)}
          </div>
          <div className="sidebar-patient-name">{providerName}</div>
          <div className="sidebar-patient-sub">{role}</div>
        </div>
      </aside>
    </>
  )
}
