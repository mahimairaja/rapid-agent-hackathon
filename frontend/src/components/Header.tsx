import { LogOut, Menu } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  title: string
  subtitle?: string
  isDemoMode: boolean
  onMenuClick: () => void
  onLogout: () => void
  onChangePatient?: () => void
  patientCode?: string | null
  userInitials: string
  userName?: string | null
  userEmail?: string | null
}

export function Header({
  title,
  subtitle,
  isDemoMode,
  onChangePatient,
  onMenuClick,
  onLogout,
  patientCode,
  userInitials,
  userName,
  userEmail,
}: HeaderProps) {
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
          <Menu size={18} aria-hidden="true" />
        </button>

        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
      </div>

      <div className="header-actions">
        {isDemoMode && (
          <div
            className="demo-badge"
            title="Dashboard panels use synthetic demo data; assistant chat connects to the backend when available"
            role="status"
          >
            <span className="demo-badge-dot" aria-hidden="true" />
            Demo Data
          </div>
        )}

        {!isDemoMode && patientCode && onChangePatient && (
          <button
            type="button"
            className="patient-code-badge"
            onClick={onChangePatient}
            title="Change patient code"
          >
            {patientCode}
          </button>
        )}

        {/* Account menu: the avatar opens a menu instead of signing out
            directly, so a stray click can no longer end the session. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="header-avatar"
              aria-label="Open account menu"
              id="user-avatar-btn"
            >
              {userInitials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold text-foreground">{userName ?? 'Signed in'}</p>
              {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem id="menu-sign-out" onSelect={onLogout}>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
