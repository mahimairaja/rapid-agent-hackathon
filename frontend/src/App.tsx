import { useState, useEffect, useRef } from 'react'
import './index.css'
import './App.css'

import type { AppView, Patient, Medication, Appointment } from './types'

import { LoginScreen } from './components/LoginScreen'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DashboardHero } from './components/DashboardHero'
import { StatCards } from './components/StatCard'
import { RecoveryPlan } from './components/RecoveryPlan'
import { MedicationSchedule } from './components/MedicationSchedule'
import { AppointmentTimeline } from './components/AppointmentTimeline'
import { AssistantChat } from './components/AssistantChat'
import { VoiceConsole } from './components/VoiceConsole'
import { SymptomCheckInForm } from './components/SymptomCheckIn'
import { CareTeamPanel } from './components/CareTeamPanel'
import { LoadingState } from './components/LoadingState'
import { PatientCodeGate } from './components/PatientCodeGate'
import { ProfessionalApp } from './components/ProfessionalApp'

import {
  getStoredToken,
  clearStoredToken,
  clearStoredPatientCode,
  fetchPatientDashboard,
  getClientTimeZone,
  getStoredPatientCode,
  loadDashboardData,
  setStoredPatientCode,
  getStoredRole,
  setStoredRole,
  clearStoredRole,
} from './api/client'

// ── Page metadata ──────────────────────────────────────────────────────────────

const PAGE_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: 'Recovery Dashboard', subtitle: 'Your personalized recovery overview' },
  medications: { title: 'Medication Schedule', subtitle: 'Daily medications and instructions' },
  appointments: { title: 'Appointment Timeline', subtitle: 'Upcoming follow-up appointments' },
  assistant: { title: 'AI Recovery Assistant', subtitle: 'Ask anything about your recovery' },
  voice: { title: 'Voice Conversation', subtitle: 'Talk to Homeward and interrupt any time' },
  'symptom-check': {
    title: 'Symptom Check-In',
    subtitle: 'Monitor and triage how you are feeling',
  },
  'care-team': {
    title: 'Care Team',
    subtitle: 'Your dedicated recovery team and emergency contacts',
  },
}

// Module-level helper so the impure Date.now() call stays out of render.
function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

// ── Root App ──────────────────────────────────────────────────────────────────

function App() {
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [patientCode, setPatientCode] = useState<string | null>(getStoredPatientCode)
  const [role, setRole] = useState<'patient' | 'professional' | null>(getStoredRole)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const [patient, setPatient] = useState<Patient | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [activeView, setActiveView] = useState<AppView>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState<string | null>(null)
  // The patient code whose data is already on screen. Used to tell an initial
  // load (show the full-screen loader) from a background refresh (e.g. after a
  // chat turn), which must not toggle screen-level loading or it would unmount
  // and remount the AssistantChat, wiping the live conversation and session id.
  const loadedCodeRef = useRef<string | null>(null)

  // Load data when we have a token
  useEffect(() => {
    if (!token) return
    let cancelled = false

    void (async () => {
      if (token === 'demo') {
        setLoading(true)
        const data = await loadDashboardData()
        if (!cancelled) {
          setPatient(data.patient)
          setMedications(data.medications)
          setAppointments(data.appointments)
          setIsDemoMode(data.demo)
          setDashboardError('')
          setLoading(false)
        }
        return
      }

      if (!patientCode) {
        setPatient(null)
        setMedications([])
        setAppointments([])
        setIsDemoMode(false)
        setLoading(false)
        return
      }

      // First load for this code blocks the screen; a same-code refresh (chat
      // turn) fetches in the background so the dashboard and chat stay mounted.
      const isInitialLoad = loadedCodeRef.current !== patientCode
      if (isInitialLoad) setLoading(true)
      setDashboardError('')
      try {
        const data = await fetchPatientDashboard(
          { patient_code: patientCode, time_zone: getClientTimeZone() },
          token,
        )
        if (!cancelled) {
          loadedCodeRef.current = patientCode
          setPatient(data.patient)
          setMedications(data.medications)
          setAppointments(data.appointments)
          setIsDemoMode(data.demo)
        }
      } catch (err) {
        // Only fall back to the code gate when the very first load fails. A
        // failed background refresh keeps the current dashboard in place.
        if (!cancelled && isInitialLoad) {
          setPatient(null)
          setMedications([])
          setAppointments([])
          setDashboardError(err instanceof Error ? err.message : 'Could not load this patient.')
        }
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [patientCode, refreshKey, token])

  const handleLogin = (
    newToken: string,
    demo: boolean,
    userRole: 'patient' | 'professional' = 'patient',
  ) => {
    setToken(newToken)
    setIsDemoMode(demo)
    setRole(userRole)
    setStoredRole(userRole)
  }

  const handleDemoAccess = () => {
    clearStoredToken()
    setToken('demo')
    setIsDemoMode(true)
    clearStoredPatientCode()
    setPatientCode(null)
    setRole('patient')
    setStoredRole('patient')
  }

  const handlePatientCodeSubmit = (newPatientCode: string) => {
    const normalized = newPatientCode.trim().toUpperCase()
    setStoredPatientCode(normalized)
    setPatientCode(normalized)
    setRefreshKey((prev) => prev + 1)
  }

  const handleChangePatient = () => {
    clearStoredPatientCode()
    loadedCodeRef.current = null
    setPatientCode(null)
    setPatient(null)
    setMedications([])
    setAppointments([])
    setDashboardError('')
    setActiveView('dashboard')
  }

  const handleLogout = () => {
    clearStoredToken()
    clearStoredPatientCode()
    clearStoredRole()
    loadedCodeRef.current = null
    setToken(null)
    setPatientCode(null)
    setRole(null)
    setPatient(null)
    setMedications([])
    setAppointments([])
    setIsDemoMode(false)
    setActiveView('dashboard')
    setDashboardError('')
  }

  const handleAssistantPrompt = (prompt: string) => {
    setAssistantDraft(prompt)
    setActiveView('assistant')
  }

  const handleAssistantTurnComplete = () => {
    setAssistantDraft(null)
    if (token && token !== 'demo' && patientCode) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  // Derived values
  const hasMedicationAdherence = medications.some((m) => typeof m.taken_today === 'boolean')
  const medicationsDue = hasMedicationAdherence
    ? medications.filter((m) => m.taken_today === false).length
    : medications.length
  const completedToday = hasMedicationAdherence
    ? medications.filter((m) => m.taken_today).length
    : 0
  const nextAppointment = appointments
    .filter((a) => a.status !== 'completed')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]
  const nextAppointmentDays = nextAppointment ? daysUntil(nextAppointment.start) : 0

  // Not logged in
  if (!token || !role) {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (role === 'professional') {
    return <ProfessionalApp onLogout={handleLogout} />
  }

  if (token !== 'demo' && (!patientCode || dashboardError)) {
    return (
      <PatientCodeGate
        error={dashboardError}
        initialCode={patientCode}
        loading={loading}
        onDemoAccess={handleDemoAccess}
        onLogout={handleLogout}
        onSubmit={handlePatientCodeSubmit}
      />
    )
  }

  // Loading initial data
  if (loading || !patient) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-logo">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <LoadingState message="Loading your recovery dashboard…" />
      </div>
    )
  }

  const { title, subtitle } = PAGE_META[activeView]
  const userInitials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        patientName={`${patient.first_name} ${patient.last_name}`}
        riskLevel={patient.risk_level ?? 'moderate'}
        recoveryStage={patient.recovery_stage ?? 'week-1'}
      />

      {/* Main content */}
      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          isDemoMode={isDemoMode}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          onChangePatient={token === 'demo' ? undefined : handleChangePatient}
          patientCode={token === 'demo' ? null : patientCode}
          userInitials={userInitials}
        />

        <main className="page-body">
          {activeView === 'dashboard' && (
            <DashboardView
              patient={patient}
              medications={medications}
              appointments={appointments}
              medicationsDue={medicationsDue}
              completedToday={completedToday}
              hasMedicationAdherence={hasMedicationAdherence}
              nextAppointmentDays={nextAppointmentDays}
              onAssistantPrompt={handleAssistantPrompt}
              onAssistantTurnComplete={handleAssistantTurnComplete}
              token={token === 'demo' ? null : token}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'medications' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">💊 Medication Schedule</div>
                <div className="view-header-sub">
                  {hasMedicationAdherence
                    ? `${completedToday} of ${medications.length} medications taken today`
                    : `${medications.length} active medication${medications.length !== 1 ? 's' : ''} on this plan`}
                </div>
              </div>
              <div className="card">
                <div className="card-accent-bar" />
                <div className="card-body" style={{ paddingTop: 20 }}>
                  <MedicationSchedule medications={medications} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'appointments' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">📅 Appointment Timeline</div>
                <div className="view-header-sub">
                  {appointments.filter((a) => a.status !== 'completed').length} upcoming
                  appointments — next in {nextAppointmentDays} day
                  {nextAppointmentDays !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="card">
                <div className="card-accent-bar" />
                <div className="card-header" style={{ paddingBottom: 0 }}>
                  <div>
                    <div className="card-title">Follow-up scheduling</div>
                    <div className="card-subtitle">
                      Use the assistant to book, check, or move a visit
                    </div>
                  </div>
                </div>
                <div className="appointment-actions">
                  <button
                    type="button"
                    onClick={() => handleAssistantPrompt('Can you book my follow-up?')}
                  >
                    Book
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssistantPrompt('When is my follow-up?')}
                  >
                    Check
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssistantPrompt('Can I move my follow-up?')}
                  >
                    Move
                  </button>
                </div>
                <div className="card-body" style={{ paddingTop: 20 }}>
                  <AppointmentTimeline appointments={appointments} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'assistant' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">🤖 AI Recovery Assistant</div>
                <div className="view-header-sub">
                  Powered by Gemini · Ask about medications, symptoms, restrictions, or your
                  recovery plan
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <AssistantChat
                  key={assistantDraft ?? 'assistant-view'}
                  initialInput={assistantDraft}
                  onTurnComplete={handleAssistantTurnComplete}
                  token={token === 'demo' ? null : token}
                  userInitials={userInitials}
                />
              </div>
            </div>
          )}

          {activeView === 'voice' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">🎙️ Voice Conversation</div>
                <div className="view-header-sub">
                  Speak with Homeward hands-free — it listens, answers aloud, and you can interrupt
                  any time
                </div>
              </div>
              <VoiceConsole />
            </div>
          )}

          {activeView === 'symptom-check' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">📈 Symptom Check-In</div>
                <div className="view-header-sub">
                  Log how you're feeling right now — AI will triage and give personalized guidance
                </div>
              </div>
              <div className="card">
                <div
                  className="card-accent-bar"
                  style={{ background: 'linear-gradient(90deg, var(--amber-400), var(--red-400))' }}
                />
                <div className="card-body" style={{ paddingTop: 20 }}>
                  <SymptomCheckInForm />
                </div>
              </div>
            </div>
          )}

          {activeView === 'care-team' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">👥 Your Care Team</div>
                <div className="view-header-sub">
                  Contact information, emergency warning signs, and care team escalation
                </div>
              </div>
              <CareTeamPanel careTeam={patient.care_team ?? []} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Dashboard composite view ───────────────────────────────────────────────────

interface DashboardViewProps {
  patient: Patient
  medications: Medication[]
  appointments: Appointment[]
  medicationsDue: number
  completedToday: number
  hasMedicationAdherence: boolean
  nextAppointmentDays: number
  onAssistantPrompt: (prompt: string) => void
  onAssistantTurnComplete: () => void
  token: string | null
  onNavigate: (view: AppView) => void
}

function DashboardView({
  patient,
  medications,
  appointments,
  medicationsDue,
  completedToday,
  hasMedicationAdherence,
  nextAppointmentDays,
  onAssistantPrompt,
  onAssistantTurnComplete,
  token,
  onNavigate,
}: DashboardViewProps) {
  return (
    <div>
      {/* ① Hero — the 5-second wow */}
      <DashboardHero
        patient={patient}
        medications={medications}
        appointments={appointments}
        hasMedicationAdherence={hasMedicationAdherence}
        onNavigate={onNavigate}
      />

      {/* ② Stat cards */}
      <StatCards
        patient={patient}
        medicationsDue={medicationsDue}
        nextAppointmentDays={nextAppointmentDays}
        completedToday={completedToday}
        hasMedicationAdherence={hasMedicationAdherence}
      />

      {/* ③ Main grid */}
      <div className="dashboard-grid">
        {/* Recovery plan — full width */}
        <div className="col-full">
          <div className="card">
            <div className="card-accent-bar" />
            <div className="card-header" style={{ paddingTop: 18 }}>
              <div>
                <div className="card-title">🎯 Recovery Plan</div>
                <div className="card-subtitle">
                  Week-by-week milestones, goals, and restrictions
                </div>
              </div>
              <span className="badge badge-blue">Week 1 Active</span>
            </div>
            <div className="card-body">
              <RecoveryPlan />
            </div>
          </div>
        </div>

        {/* Medications */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div>
                <div className="card-title">💊 Today's Medications</div>
                <div className="card-subtitle">
                  {hasMedicationAdherence
                    ? `${completedToday} of ${medications.length} taken`
                    : `${medications.length} active on plan`}
                </div>
              </div>
              {hasMedicationAdherence && medicationsDue > 0 && (
                <span className="badge badge-amber">{medicationsDue} due</span>
              )}
            </div>
            <div className="card-body">
              <MedicationSchedule medications={medications.slice(0, 3)} />
            </div>
          </div>
        </div>

        {/* Appointments */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div>
                <div className="card-title">📅 Upcoming Appointments</div>
                <div className="card-subtitle">
                  Next in {nextAppointmentDays} day{nextAppointmentDays !== 1 ? 's' : ''}
                </div>
              </div>
              <span className="badge badge-teal">
                {appointments.filter((a) => a.status !== 'completed').length} scheduled
              </span>
            </div>
            <div className="appointment-actions compact">
              <button type="button" onClick={() => onAssistantPrompt('Can you book my follow-up?')}>
                Book follow-up
              </button>
              <button type="button" onClick={() => onAssistantPrompt('When is my follow-up?')}>
                Check
              </button>
              <button type="button" onClick={() => onAssistantPrompt('Can I move my follow-up?')}>
                Move
              </button>
            </div>
            <div className="card-body">
              <AppointmentTimeline appointments={appointments.slice(0, 2)} />
            </div>
          </div>
        </div>

        {/* AI Chat — full width, central hero feature */}
        <div className="col-full">
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ paddingBottom: 0 }}>
              <div>
                <div className="card-title">🤖 AI Recovery Assistant</div>
                <div className="card-subtitle">
                  Ask about medications, symptoms, restrictions, or what's safe to do today
                </div>
              </div>
              <span className="badge badge-green live-dot">Online</span>
            </div>
            <AssistantChat
              initialInput={null}
              onTurnComplete={onAssistantTurnComplete}
              token={token}
              userInitials={`${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
