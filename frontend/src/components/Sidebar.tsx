import { NavLink } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Pill,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  patientName: string
  riskLevel: string
  recoveryStage: string
}

interface NavItem {
  id: string
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="sidebar-nav-icon" aria-hidden="true" />,
  },
  {
    id: 'medications',
    to: '/medications',
    label: 'Medications',
    icon: <Pill className="sidebar-nav-icon" aria-hidden="true" />,
  },
  {
    id: 'appointments',
    to: '/appointments',
    label: 'Appointments',
    icon: <CalendarDays className="sidebar-nav-icon" aria-hidden="true" />,
  },
  {
    id: 'maya',
    to: '/maya',
    label: 'Maya',
    icon: <Sparkles className="sidebar-nav-icon" aria-hidden="true" />,
  },
  {
    id: 'symptom-check',
    to: '/symptom-check',
    label: 'Symptom Check',
    icon: <Activity className="sidebar-nav-icon" aria-hidden="true" />,
  },
  {
    id: 'care-team',
    to: '/care-team',
    label: 'Care Team',
    icon: <Users className="sidebar-nav-icon" aria-hidden="true" />,
  },
]

export function Sidebar({ isOpen, onClose, patientName, riskLevel, recoveryStage }: SidebarProps) {
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
              <span className="logo-name">Rapid Recovery</span>
              <span className="logo-tagline">Recovery Assistant</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              id={`nav-${item.id}`}
              to={item.to}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Patient info. Hidden until the assistant has identified the patient
            (conversational onboarding), when the name becomes available. */}
        {patientName ? (
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
            <div className="sidebar-patient-sub">
              {STAGE_LABELS[recoveryStage] ?? recoveryStage}
            </div>
            <div className={`sidebar-risk-badge ${riskLevel}`}>
              <span className="sidebar-risk-dot" />
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </div>
          </div>
        ) : (
          <div className="sidebar-patient">
            <div className="sidebar-patient-avatar" aria-hidden="true">
              <UserRound size={18} />
            </div>
            <div className="sidebar-patient-name">Welcome</div>
            <div className="sidebar-patient-sub">Say hi to load your plan</div>
          </div>
        )}
      </aside>
    </>
  )
}
