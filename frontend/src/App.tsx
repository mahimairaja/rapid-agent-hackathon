import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import './index.css'
import './App.css'

import type { ClaimResponse, Patient, Medication, Appointment, SessionContext } from './types'

import { LoginScreen } from './components/LoginScreen'
import { LandingPage } from './components/LandingPage'
import { JoinWizard } from './components/JoinWizard'
import { JourneyOnboarding } from './components/JourneyOnboarding'
import { AppointmentCalendar } from './components/AppointmentCalendar'
import { PatientLayout } from './components/PatientLayout'
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
  ApiError,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  clearStoredPatientCode,
  getMe,
  getSessionContext,
  loadDashboardData,
  getStoredRole,
  setStoredRole,
  clearStoredRole,
} from './api/client'

// Sidebar / dashboard shortcuts still speak in view names; the router speaks
// in paths.
const VIEW_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  medications: '/medications',
  appointments: '/appointments',
  assistant: '/maya',
  'symptom-check': '/symptom-check',
  'care-team': '/care-team',
}

// Module-level helper so the impure Date.now() call stays out of render.
function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

// The /join route reads the preselected journey from the URL, so a landing
// card click survives refreshes and back/forward.
function JoinRoute(props: {
  onComplete: (token: string, claim: ClaimResponse) => void
  onBack: () => void
  onLoginInstead: () => void
}) {
  const [params] = useSearchParams()
  return <JoinWizard preselectedJourney={params.get('journey')} {...props} />
}

// ── Root App ──────────────────────────────────────────────────────────────────

function App() {
  const navigate = useNavigate()
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

  // Journey onboarding: the account's linked patient code (drives deterministic
  // session identification), the display name for greetings, the live session
  // id (drives the calendar widget), and which token's /users/me has resolved.
  const [identifyCode, setIdentifyCode] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [checkedToken, setCheckedToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  // A symptom report handed from the check-in form into the live assistant.
  const [pendingReport, setPendingReport] = useState<string | null>(null)

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
          setUserEmail(me.email ?? null)
        }
      } catch (err) {
        if (cancelled) return
        // An expired or revoked token cannot claim or identify anything:
        // return to the login screen instead of a gallery that cannot work.
        if (err instanceof ApiError && err.status === 401) {
          clearStoredToken()
          clearStoredRole()
          setToken(null)
          setRole(null)
          return
        }
        setIdentifyCode(null)
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
    setUserEmail(null)
    setCheckedToken(null)
    setSessionId(null)
    navigate('/')
  }

  // First-time onboarding finished: remember the profile and enter the app.
  // The Assistant mounts with this identify code and verifies the session.
  const handleClaimComplete = (claim: ClaimResponse) => {
    setIdentifyCode(claim.patient_code)
    setUserName(`${claim.first_name} ${claim.last_name}`.trim())
  }

  // Join wizard finished: it already created the account, logged in, and
  // claimed the journey. Persist the session and enter the app as a patient.
  const handleJoinComplete = (newToken: string, claim: ClaimResponse) => {
    setStoredToken(newToken)
    setStoredRole('patient')
    setIsDemoMode(false)
    setToken(newToken)
    setRole('patient')
    handleClaimComplete(claim)
  }

  // After the calendar books a follow-up, refetch the session context so the
  // timeline, dashboard, and grounding panel agree with the new booking.
  const handleCalendarBooked = () => {
    if (!sessionId) return
    void getSessionContext(sessionId).then(handleSessionContext)
  }

  // Deep-link from dashboard / appointment shortcuts into Maya. She runs her
  // own live conversation, so the prompt text is not pre-filled; the shortcut
  // just brings the patient to the right place.
  const handleAssistantPrompt = () => {
    navigate('/maya')
  }

  // The symptom check-in form submits into the live conversation: the agent
  // runs the real triage (check-in or red-flag escalation) and replies there.
  const handleSymptomReport = (text: string) => {
    setPendingReport(text)
    navigate('/maya')
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

  const loggedOut = !token || !role
  const goView = (view: string) => navigate(VIEW_PATHS[view] ?? '/maya')

  // ── Pre-auth route elements ─────────────────────────────────────────────────

  const authedHome = role === 'professional' ? '/provider' : '/maya'

  const landingEl = loggedOut ? (
    <LandingPage
      onJoin={(code) => navigate(code ? `/join?journey=${encodeURIComponent(code)}` : '/join')}
      onLogin={() => navigate('/login')}
    />
  ) : (
    <Navigate to={authedHome} replace />
  )

  const loginEl = loggedOut ? (
    <LoginScreen onLogin={handleLogin} onBack={() => navigate('/')} />
  ) : (
    <Navigate to={authedHome} replace />
  )

  const joinEl = loggedOut ? (
    <JoinRoute
      onComplete={handleJoinComplete}
      onBack={() => navigate('/')}
      onLoginInstead={() => navigate('/login')}
    />
  ) : (
    <Navigate to="/maya" replace />
  )

  const providerEl =
    token && role === 'professional' ? (
      <ProfessionalApp onLogout={handleLogout} />
    ) : (
      <Navigate to="/" replace />
    )

  // ── Journey gallery (old accounts without a claimed journey) ───────────────

  const welcomeEl = (() => {
    if (!token || role !== 'patient') return <Navigate to="/" replace />
    if (token === 'demo') return <Navigate to="/maya" replace />
    if (!accountChecked) {
      return (
        <div className="app-loading-screen">
          <LoadingState message="Checking your profile…" />
        </div>
      )
    }
    if (identifyCode) return <Navigate to="/maya" replace />
    return (
      <JourneyOnboarding
        token={token}
        initialName={userName ?? ''}
        onComplete={handleClaimComplete}
        onLogout={handleLogout}
      />
    )
  })()

  // ── Patient shell (layout route with the always-mounted Maya) ──────────────

  const patientShellEl = (() => {
    if (!token || !role) return <Navigate to="/" replace />
    if (role === 'professional') return <Navigate to="/provider" replace />
    if (token !== 'demo' && !accountChecked) {
      return (
        <div className="app-loading-screen">
          <LoadingState message="Checking your profile…" />
        </div>
      )
    }
    if (token !== 'demo' && !identifyCode) return <Navigate to="/welcome" replace />
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
    return (
      <PatientLayout
        assistant={
          <Assistant
            onContext={handleSessionContext}
            onSession={setSessionId}
            identifyCode={token === 'demo' ? null : identifyCode}
            userName={userName}
            outboundText={pendingReport}
            onOutboundConsumed={() => setPendingReport(null)}
          />
        }
        patient={patient}
        isDemoMode={isDemoMode}
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
      />
    )
  })()

  // ── Tab route elements ──────────────────────────────────────────────────────

  const dashboardEl = patient ? (
    <DashboardView
      patient={patient}
      medications={medications}
      appointments={appointments}
      medicationsDue={medicationsDue}
      completedToday={completedToday}
      hasMedicationAdherence={hasMedicationAdherence}
      nextAppointmentDays={nextAppointmentDays}
      onAssistantPrompt={handleAssistantPrompt}
      onNavigate={goView}
    />
  ) : (
    <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
  )

  const medicationsEl = patient ? (
    <div className="card">
      <div className="card-accent-bar" />
      <div className="card-body" style={{ paddingTop: 20 }}>
        <MedicationSchedule medications={medications} />
      </div>
    </div>
  ) : (
    <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
  )

  const appointmentsEl = patient ? (
    <div>
      <AppointmentCalendar sessionId={sessionId} onBooked={handleCalendarBooked} />
      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-accent-bar" />
        <div className="card-header" style={{ paddingBottom: 0 }}>
          <div>
            <div className="card-title">Follow-up scheduling</div>
            <div className="card-subtitle">Ask Maya to book, check, or move a visit</div>
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
  ) : (
    <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
  )

  const symptomEl = (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <SymptomCheckInForm onSubmitReport={handleSymptomReport} />
      </div>
    </div>
  )

  const careTeamEl = patient ? (
    <CareTeamPanel careTeam={patient.care_team ?? []} clinician={patient.assigned_clinician} />
  ) : (
    <IdentifyCallout onOpenAssistant={handleAssistantPrompt} />
  )

  return (
    <Routes>
      <Route path="/" element={landingEl} />
      <Route path="/login" element={loginEl} />
      <Route path="/join" element={joinEl} />
      <Route path="/provider" element={providerEl} />
      <Route path="/welcome" element={welcomeEl} />
      <Route element={patientShellEl}>
        <Route path="/maya" element={null} />
        <Route path="/dashboard" element={dashboardEl} />
        <Route path="/medications" element={medicationsEl} />
        <Route path="/appointments" element={appointmentsEl} />
        <Route path="/symptom-check" element={symptomEl} />
        <Route path="/care-team" element={careTeamEl} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
        <div
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}
          aria-hidden="true"
        >
          <Sparkles size={40} color="var(--blue-400)" />
        </div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
          Let's find your recovery plan
        </h3>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 22px', lineHeight: 1.6 }}>
          Tell Maya who you are — just say or type your name and date of birth, or your patient code
          — and your dashboard, medications, and appointments will load automatically.
        </p>
        <button
          type="button"
          className="login-submit-btn"
          style={{ width: 'auto', padding: '12px 28px', margin: '0 auto' }}
          onClick={onOpenAssistant}
        >
          Talk to Maya
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
  onAssistantPrompt: () => void
  onNavigate: (view: string) => void
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
                <div className="card-title">Recovery Plan</div>
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
                <div className="card-title">Today's Medications</div>
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
              <MedicationSchedule medications={medications.slice(0, 3)} compact />
            </div>
          </div>
        </div>

        {/* Appointments */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Upcoming Appointments</div>
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
              <button type="button" onClick={onAssistantPrompt}>
                Book follow-up
              </button>
              <button type="button" onClick={onAssistantPrompt}>
                Check
              </button>
              <button type="button" onClick={() => onNavigate('appointments')}>
                Open calendar
              </button>
            </div>
            <div className="card-body">
              <AppointmentTimeline appointments={appointments.slice(0, 2)} />
            </div>
          </div>
        </div>

        {/* The conversation lives with Maya (voice + chat on one live session);
            the hero's assistant button leads there. */}
      </div>
    </div>
  )
}

export default App
