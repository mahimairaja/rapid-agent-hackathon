import { useState } from 'react'
import type { ProfessionalAppView } from '../types'
import { ProfessionalSidebar } from './ProfessionalSidebar'
import { Header } from './Header'
import { PatientQueue } from './PatientQueue'
import { ProfessionalPatientProfile } from './ProfessionalPatientProfile'
import { PatientDirectory } from './PatientDirectory'
import { ProfessionalAppointments } from './ProfessionalAppointments'
import { ProfessionalEscalationCenter } from './ProfessionalEscalationCenter'

interface ProfessionalAppProps {
  onLogout: () => void
}

export function ProfessionalApp({ onLogout }: ProfessionalAppProps) {
  const [activeView, setActiveView] = useState<ProfessionalAppView>('patient-queue')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNavigate = (view: ProfessionalAppView, payload?: string) => {
    setActiveView(view)
    if (view === 'patient-profile') {
      setSelectedPatientId(payload || null)
    } else {
      setSelectedPatientId(null)
    }
  }

  // Use a mock provider name
  const providerName = 'Dr. Sarah Smith'
  const role = 'Attending Physician'

  const getPageMeta = (view: ProfessionalAppView) => {
    switch (view) {
      case 'patient-queue':
        return { title: 'Patient Queue', subtitle: 'Manage your active patients and escalations' }
      case 'patient-profile':
        return { title: 'Patient Profile', subtitle: 'Detailed view of patient status' }
      case 'escalation-center':
        return { title: 'Escalation Center', subtitle: 'Review and triage critical alerts' }
      case 'appointments':
        return { title: 'Appointments', subtitle: 'Manage upcoming visits' }
      default:
        return { title: 'Provider Dashboard', subtitle: '' }
    }
  }

  const { title, subtitle } = getPageMeta(activeView)

  return (
    <div className="app-layout">
      <ProfessionalSidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        providerName={providerName}
        role={role}
      />

      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          isDemoMode={true}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          userInitials="SS"
        />

        <main className="page-body">
          {activeView === 'patient-queue' && <PatientQueue onNavigate={handleNavigate} />}
          {activeView === 'patient-profile' && selectedPatientId && <ProfessionalPatientProfile patientId={selectedPatientId} onNavigate={handleNavigate} />}
          {activeView === 'patient-profile' && !selectedPatientId && <PatientDirectory onNavigate={handleNavigate} />}
          {activeView === 'appointments' && <ProfessionalAppointments />}
          {activeView === 'escalation-center' && <ProfessionalEscalationCenter onNavigate={handleNavigate} />}

          {activeView !== 'patient-queue' && activeView !== 'patient-profile' && activeView !== 'appointments' && activeView !== 'escalation-center' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Under Construction</h2>
              <p>The {title} view is coming soon.</p>
              <button
                type="button"
                onClick={() => setActiveView('patient-queue')}
                style={{ marginTop: 24, padding: '8px 16px', background: 'var(--blue-500)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Return to Patient Queue
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
