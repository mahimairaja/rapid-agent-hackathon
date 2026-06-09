import type { AppView } from '../types'

interface SidebarProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
  isOpen: boolean
  onClose: () => void
  patientName: string
  riskLevel: string
  recoveryStage: string
}

interface NavItem {
  id: AppView
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" />
        <circle cx="18" cy="18" r="4" />
        <path d="M18 16v2h2" />
      </svg>
    ),
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="12" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'symptom-check',
    label: 'Symptom Check',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'care-team',
    label: 'Care Team',
    icon: (
      <svg
        className="sidebar-nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export function Sidebar({
  activeView,
  onNavigate,
  isOpen,
  onClose,
  patientName,
  riskLevel,
  recoveryStage,
}: SidebarProps) {
  const STAGE_LABELS: Record<string, string> = {
    'week-1': 'Week 1 Recovery',
    'week-2': 'Week 2 Recovery',
    'week-3': 'Week 3 Recovery',
    'week-4': 'Week 4 Recovery',
    'month-2': 'Month 2',
    'month-3': 'Month 3',
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${isOpen ? ' active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar${isOpen ? ' open' : ''}`} aria-label="Main navigation">
        {/* Logo */}
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
              <span className="logo-name">Rapid Agent</span>
              <span className="logo-tagline">Recovery Assistant</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              type="button"
              className={`sidebar-nav-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => {
                onNavigate(item.id)
                onClose()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Patient info */}
        <div className="sidebar-patient">
          <div className="sidebar-patient-avatar" aria-hidden="true">
            {patientName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div className="sidebar-patient-name">{patientName}</div>
          <div className="sidebar-patient-sub">{STAGE_LABELS[recoveryStage] ?? recoveryStage}</div>
          <div className={`sidebar-risk-badge ${riskLevel}`}>
            <span className="sidebar-risk-dot" />
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </div>
        </div>
      </aside>
    </>
  )
}
