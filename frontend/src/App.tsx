import { useState, useEffect } from 'react'
import './index.css'
import './App.css'

import type {
  AppView,
  ClaimResponse,
  Patient,
  Medication,
  Appointment,
  SessionContext,
} from './types'

import { LoginScreen } from './components/LoginScreen'
import { JourneyOnboarding } from './components/JourneyOnboarding'
import { AppointmentCalendar } from './components/AppointmentCalendar'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DashboardHero } from './components/DashboardHero'
import { StatCards } from './components/StatCard'
import { RecoveryPlan } from './components/RecoveryPlan'
import { MedicationSchedule } from './components/MedicationSchedule'
import { AppointmentTimeline } from './components/AppointmentTimeline'
import { Assistant } from './components/Assistant'
import { SymptomCheckInForm } from './components/SymptomCheckIn'
import { CareTeamPanel } from './components/CareTeamPanel'
import { LoadingState } from './components/LoadingState'
import { ProfessionalApp } from './components/ProfessionalApp'

import {
  getStoredToken,
  clearStoredToken,
  clearStoredPatientCode,
  getMe,
  getSessionContext,
  loadDashboardData,
  getStoredRole,
  setStoredRole,
  clearStoredRole,
} from './api/client'

// ── Page metadata ──────────────────────────────────────────────────────────────

const PAGE_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: 'Recovery Dashboard', subtitle: 'Your personalized recovery overview' },
  medications: { title: 'Medication Schedule', subtitle: 'Daily medications and instructions' },
  appointments: { title: 'Appointment Timeline', subtitle: 'Upcoming follow-up appointments' },
  assistant: {
    title: 'Recovery Assistant',
    subtitle: 'Talk or type — answers grounded in your own plan',
  },
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
  const [role, setRole] = useState<'patient' | 'professional' | null>(getStoredRole)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Patient data hydrates from the conversation: once the assistant verifies
  // who the patient is (name + DOB or patient code), the live session's context
  // fills the dashboard, medications, and appointments. There is no patient
  // code gate; accounts are not linked to patient records.
  const [patient, setPatient] = useState<Patient | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)

  const [activeView, setActiveView] = useState<AppView>('assistant')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Journey onboarding: the account's linked patient code (drives deterministic
  // session identification), the display name for greetings, the live session
  // id (drives the calendar widget), and which token's /users/me has resolved.
  const [identifyCode, setIdentifyCode] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [checkedToken, setCheckedToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // The demo entry point shows mock data immediately; a signed-in patient
  // starts empty and hydrates through the assistant.
  useEffect(() => {
    if (token !== 'demo') return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const data = await loadDashboardData()
      if (!cancelled) {
        setPatient(data.patient)
        setMedications(data.medications)
        setAppointments(data.appointments)
        setIsDemoMode(data.demo)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Signed-in patients: look up the account's journey link. A linked account
  // skips the gallery and auto-identifies; an unlinked (or unreadable) account
  // sees the gallery, and claiming is idempotent so a stale read is harmless.
  useEffect(() => {
    if (!token || token === 'demo' || role !== 'patient') return
    let cancelled = false
    void (async () => {
      try {
        const me = await getMe(token)
        if (!cancelled) {
          setIdentifyCode(me.patient_code ?? null)
          setUserName(me.full_name ?? null)
        }
      } catch {
        if (!cancelled) setIdentifyCode(null)
      } finally {
        if (!cancelled) setCheckedToken(token)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, role])

  // True once the current token's account link has been resolved (demo and
  // logged-out states need no check).
  const accountChecked = !token || token === 'demo' || role !== 'patient' || checkedToken === token

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

  const handleLogout = () => {
    clearStoredToken()
    clearStoredPatientCode()
    clearStoredRole()
    setToken(null)
    setRole(null)
    setPatient(null)
    setMedications([])
    setAppointments([])
    setIsDemoMode(false)
    setIdentifyCode(null)
    setUserName(null)
    setCheckedToken(null)
    setSessionId(null)
    setActiveView('assistant')
  }

  // First-time onboarding finished: remember the profile and enter the app.
  // The Assistant mounts with this identify code and verifies the session.
  const handleClaimComplete = (claim: ClaimResponse) => {
    setIdentifyCode(claim.patient_code)
    setUserName(`${claim.first_name} ${claim.last_name}`.trim())
  }

  // After the calendar books a follow-up, refetch the session context so the
  // timeline, dashboard, and grounding panel agree with the new booking.
  const handleCalendarBooked = () => {
    if (!sessionId) return
    void getSessionContext(sessionId).then(handleSessionContext)
  }

  // Deep-link from dashboard / appointment shortcuts into the unified Assistant.
  // The Assistant runs its own live conversation, so the prompt text is not
  // pre-filled; the shortcut just brings the patient to the right place.
  const handleAssistantPrompt = () => {
    setActiveView('assistant')
  }

  // Conversational onboarding: once the assistant verifies the patient, its
  // session context hydrates every tab (dashboard, medications, appointments).
  const handleSessionContext = (ctx: SessionContext) => {
    if (ctx.verified && ctx.patient) {
      setPatient(ctx.patient)
      setMedications(ctx.medications ?? [])
      setAppointments(ctx.appointments ?? [])
      setIsDemoMode(false)
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

  // Signed-in patients: wait for the account check, then route first-timers
  // through the journey gallery. Returning users land straight in the app and
  // auto-identify. Demo mode skips all of this.
  if (token !== 'demo' && !accountChecked) {
    return (
      <div className="app-loading-screen">
        <LoadingState message="Checking your profile…" />
      </div>
    )
  }
  if (token !== 'demo' && !identifyCode) {
    return (
      <JourneyOnboarding
        token={token}
        initialName={userName ?? ''}
        onComplete={handleClaimComplete}
        onLogout={handleLogout}
      />
    )
  }

  // Loading initial demo data. A signed-in patient renders the shell right
  // away and lands in the assistant, which identifies them conversationally.
  if (token === 'demo' && (loading || !patient)) {
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
  const userInitials = patient
    ? `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
    : 'ME'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : ''}
        riskLevel={patient?.risk_level ?? 'moderate'}
        recoveryStage={patient?.recovery_stage ?? 'week-1'}
      />

      {/* Main content */}
      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          isDemoMode={isDemoMode}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          userInitials={userInitials}
        />

        <main className="page-body">
          {activeView === 'dashboard' &&
            (patient ? (
              <DashboardView
                patient={patient}
                medications={medications}
                appointments={appointments}
                medicationsDue={medicationsDue}
                completedToday={completedToday}
                hasMedicationAdherence={hasMedicationAdherence}
                nextAppointmentDays={nextAppointmentDays}
                onAssistantPrompt={handleAssistantPrompt}
                onNavigate={setActiveView}
              />
            ) : (
              <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
            ))}

          {activeView === 'medications' && !patient && (
            <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
          )}
          {activeView === 'medications' && patient && (
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

          {activeView === 'appointments' && !patient && (
            <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
          )}
          {activeView === 'appointments' && patient && (
            <div>
              <AppointmentCalendar sessionId={sessionId} onBooked={handleCalendarBooked} />
              <div className="view-header" style={{ marginTop: 22 }}>
                <div className="view-header-title">📅 Appointment Timeline</div>
                <div className="view-header-sub">
                  {nextAppointment
                    ? `${appointments.filter((a) => a.status !== 'completed').length} upcoming
                       appointments — next in ${nextAppointmentDays} day${nextAppointmentDays !== 1 ? 's' : ''}`
                    : 'No upcoming appointments — ask the assistant to book your follow-up'}
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
                  <button type="button" onClick={handleAssistantPrompt}>
                    Book
                  </button>
                  <button type="button" onClick={handleAssistantPrompt}>
                    Check
                  </button>
                  <button type="button" onClick={handleAssistantPrompt}>
                    Move
                  </button>
                </div>
                <div className="card-body" style={{ paddingTop: 20 }}>
                  <AppointmentTimeline appointments={appointments} />
                </div>
              </div>
            </div>
          )}

          {/* Kept mounted (hidden when inactive) so switching tabs never tears
              down the live Gemini session or loses the conversation. */}
          <div style={{ display: activeView === 'assistant' ? 'block' : 'none' }}>
            <div className="view-header">
              <div className="view-header-title">🤖 Recovery Assistant</div>
              <div className="view-header-sub">
                Talk or type in one place. Powered by Gemini Live, with answers grounded in your own
                discharge plan.
              </div>
            </div>
            <Assistant
              onContext={handleSessionContext}
              onSession={setSessionId}
              identifyCode={token === 'demo' ? null : identifyCode}
              userName={userName}
            />
          </div>

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

          {activeView === 'care-team' && !patient && (
            <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
          )}
          {activeView === 'care-team' && patient && (
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

// ── Pre-identification callout ─────────────────────────────────────────────────

// Shown on data tabs before the assistant has identified the patient. The
// conversation is the onboarding: no patient code form, just point them at it.
function IdentifyCallout({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  return (
    <div className="card">
      <div
        className="card-body"
        style={{ textAlign: 'center', padding: '56px 24px', maxWidth: 520, margin: '0 auto' }}
      >
        <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden="true">
          👋
        </div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
          Let's find your recovery plan
        </h3>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 22px', lineHeight: 1.6 }}>
          Tell your assistant who you are — just say or type your name and date of birth, or your
          patient code — and your dashboard, medications, and appointments will load automatically.
        </p>
        <button
          type="button"
          className="login-submit-btn"
          style={{ width: 'auto', padding: '12px 28px', margin: '0 auto' }}
          onClick={onOpenAssistant}
        >
          Talk to your assistant
        </button>
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
  onNavigate,
}: DashboardViewProps) {
  const nextUpcoming = appointments
    .filter((a) => a.status !== 'completed')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]

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
        nextAppointmentKind={nextUpcoming?.kind ?? null}
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
              <RecoveryPlan condition={patient.discharge_reason} />
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
                  {appointments.some((a) => a.status !== 'completed')
                    ? `Next in ${nextAppointmentDays} day${nextAppointmentDays !== 1 ? 's' : ''}`
                    : 'None scheduled yet'}
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

        {/* The conversation lives in the unified Assistant tab (voice + chat on
            one live session); the hero's "Ask AI Assistant" button leads there. */}
      </div>
    </div>
  )
}

export default App
