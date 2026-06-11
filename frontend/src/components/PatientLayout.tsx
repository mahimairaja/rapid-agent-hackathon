import { useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import type { Patient } from '../types'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

// Page chrome per route. Maya's panel is always mounted (the live session
// must survive navigation); every other tab renders through the Outlet.
const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Recovery Dashboard', subtitle: 'Your recovery at a glance' },
  '/medications': { title: 'Medications', subtitle: 'Schedule, doses, and why each one matters' },
  '/appointments': { title: 'Appointments', subtitle: 'Book and track your follow-up visits' },
  '/maya': { title: 'Maya', subtitle: 'Your recovery companion — talk or type any time' },
  '/symptom-check': { title: 'Symptom Check', subtitle: 'Tell Maya how you feel right now' },
  '/care-team': { title: 'Care Team', subtitle: 'Your clinicians and when to reach them' },
}

interface PatientLayoutProps {
  // The Assistant element is created by App (which owns its callbacks and
  // session state) and stays mounted here across route changes.
  assistant: ReactNode
  patient: Patient | null
  isDemoMode: boolean
  userName: string | null
  userEmail: string | null
  onLogout: () => void
}

export function PatientLayout({
  assistant,
  patient,
  isDemoMode,
  userName,
  userEmail,
  onLogout,
}: PatientLayoutProps) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const meta = PAGE_META[pathname] ?? PAGE_META['/maya']
  const userInitials = patient
    ? `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
    : (userName ?? 'ME')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : ''}
        riskLevel={patient?.risk_level ?? 'moderate'}
        recoveryStage={patient?.recovery_stage ?? 'week-1'}
      />

      <div className="main-content">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          isDemoMode={isDemoMode}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          userInitials={userInitials}
          userName={userName}
          userEmail={userEmail}
        />

        <main className="page-body">
          {/* Kept mounted (hidden when inactive) so switching tabs never tears
              down the live Gemini session or loses the conversation. */}
          <div style={{ display: pathname === '/maya' ? 'block' : 'none' }}>{assistant}</div>
          {pathname !== '/maya' && <Outlet />}
        </main>
      </div>
    </div>
  )
}
