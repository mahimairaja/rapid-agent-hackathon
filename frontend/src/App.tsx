import { useState, useEffect } from 'react';
import './index.css';
import './App.css';

import type { AppView, Patient, Medication, Appointment } from './types';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardHero } from './components/DashboardHero';
import { StatCards } from './components/StatCard';
import { RecoveryPlan } from './components/RecoveryPlan';
import { MedicationSchedule } from './components/MedicationSchedule';
import { AppointmentTimeline } from './components/AppointmentTimeline';
import { AssistantChat } from './components/AssistantChat';
import { SymptomCheckInForm } from './components/SymptomCheckIn';
import { CareTeamPanel } from './components/CareTeamPanel';
import { LoadingState } from './components/LoadingState';

import {
  getStoredToken,
  clearStoredToken,
  fetchPatient,
  fetchMedications,
  fetchAppointments,
} from './api/client';

// ── Page metadata ──────────────────────────────────────────────────────────────

const PAGE_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: 'Recovery Dashboard', subtitle: 'Your personalized recovery overview' },
  medications: { title: 'Medication Schedule', subtitle: 'Daily medications and instructions' },
  appointments: { title: 'Appointment Timeline', subtitle: 'Upcoming follow-up appointments' },
  assistant: { title: 'AI Recovery Assistant', subtitle: 'Ask anything about your recovery' },
  'symptom-check': { title: 'Symptom Check-In', subtitle: 'Monitor and triage how you are feeling' },
  'care-team': { title: 'Care Team', subtitle: 'Your dedicated recovery team and emergency contacts' },
};

// ── Root App ──────────────────────────────────────────────────────────────────

function App() {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load data when we have a token
  useEffect(() => {
    if (!token) return;
    const realToken = token === 'demo' ? null : token;

    setLoading(true);
    void (async () => {
      const { data: p, demo: pd } = await fetchPatient('patient-001', realToken);
      setPatient(p);
      setIsDemoMode(prev => prev || pd);

      const [{ data: meds, demo: md }, { data: appts, demo: ad }] = await Promise.all([
        fetchMedications(p.id, realToken),
        fetchAppointments(p.id, realToken),
      ]);
      setMedications(meds);
      setAppointments(appts);
      if (md || ad) setIsDemoMode(true);
      setLoading(false);
    })();
  }, [token]);

  const handleLogin = (newToken: string, demo: boolean) => {
    setToken(newToken);
    setIsDemoMode(demo);
  };

  const handleLogout = () => {
    clearStoredToken();
    setToken(null);
    setPatient(null);
    setMedications([]);
    setAppointments([]);
    setIsDemoMode(false);
    setActiveView('dashboard');
  };

  // Derived values
  const medicationsDue = medications.filter(m => !m.taken_today).length;
  const completedToday = medications.filter(m => m.taken_today).length;
  const nextAppointment = appointments
    .filter(a => a.status !== 'completed')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  const nextAppointmentDays = nextAppointment
    ? Math.max(0, Math.ceil((new Date(nextAppointment.start).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Not logged in
  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Loading initial data
  if (loading || !patient) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <LoadingState message="Loading your recovery dashboard…" />
      </div>
    );
  }

  const { title, subtitle } = PAGE_META[activeView];
  const userInitials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase();

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
              nextAppointmentDays={nextAppointmentDays}
              token={token === 'demo' ? null : token}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'medications' && (
            <div>
              <div className="view-header">
                <div className="view-header-title">💊 Medication Schedule</div>
                <div className="view-header-sub">
                  {completedToday} of {medications.length} medications taken today — keep it up!
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
                  {appointments.filter(a => a.status !== 'completed').length} upcoming appointments — next in {nextAppointmentDays} day{nextAppointmentDays !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="card">
                <div className="card-accent-bar" />
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
                  Powered by Gemini · Ask about medications, symptoms, restrictions, or your recovery plan
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <AssistantChat
                  patientId={patient.id}
                  token={token === 'demo' ? null : token}
                />
              </div>
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
                <div className="card-accent-bar" style={{ background: 'linear-gradient(90deg, var(--amber-400), var(--red-400))' }} />
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
  );
}

// ── Dashboard composite view ───────────────────────────────────────────────────

interface DashboardViewProps {
  patient: Patient;
  medications: Medication[];
  appointments: Appointment[];
  medicationsDue: number;
  completedToday: number;
  nextAppointmentDays: number;
  token: string | null;
  onNavigate: (view: AppView) => void;
}

function DashboardView({
  patient,
  medications,
  appointments,
  medicationsDue,
  completedToday,
  nextAppointmentDays,
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
        onNavigate={onNavigate}
      />

      {/* ② Stat cards */}
      <StatCards
        patient={patient}
        medicationsDue={medicationsDue}
        nextAppointmentDays={nextAppointmentDays}
        completedToday={completedToday}
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
                <div className="card-subtitle">Week-by-week milestones, goals, and restrictions</div>
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
                  {completedToday} of {medications.length} taken
                </div>
              </div>
              {medicationsDue > 0 && (
                <span className="badge badge-amber">
                  {medicationsDue} due
                </span>
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
                {appointments.filter(a => a.status !== 'completed').length} scheduled
              </span>
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
            <AssistantChat patientId={patient.id} token={token} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
