import type { Patient, Medication, Appointment } from '../types'
import { dailyActionForCondition } from '../data/recoveryPlans'

interface DashboardHeroProps {
  patient: Patient
  medications: Medication[]
  appointments: Appointment[]
  hasMedicationAdherence: boolean
  onNavigate: (view: 'assistant' | 'symptom-check' | 'medications' | 'appointments') => void
}

const STAGE_LABELS: Record<string, string> = {
  'week-1': 'Week 1 Recovery',
  'week-2': 'Week 2 Recovery',
  'week-3': 'Week 3 Recovery',
  'week-4': 'Week 4 Recovery',
  'month-2': 'Month 2',
  'month-3': 'Month 3',
}

const STAGE_PROGRESS: Record<string, number> = {
  'week-1': 8,
  'week-2': 20,
  'week-3': 35,
  'week-4': 50,
  'month-2': 70,
  'month-3': 90,
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

export function DashboardHero({
  patient,
  medications,
  appointments,
  hasMedicationAdherence,
  onNavigate,
}: DashboardHeroProps) {
  const stage = patient.recovery_stage ?? 'week-1'
  const progress = STAGE_PROGRESS[stage] ?? 8
  const stageLabel = STAGE_LABELS[stage] ?? 'Recovery'
  const daysSinceDischarge = patient.discharge_date ? daysSince(patient.discharge_date) : 3
  const initials = getInitials(patient.first_name, patient.last_name)

  const medicationsTotal = medications.length
  const completedToday = medications.filter((m) => m.taken_today).length

  const nextAppt = appointments
    .filter((a) => a.status !== 'completed')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]

  const nextApptDays = nextAppt ? daysUntil(nextAppt.start) : 7
  const nextApptLabel =
    nextApptDays === 0 ? 'Today' : nextApptDays === 1 ? 'Tomorrow' : `In ${nextApptDays} days`

  // AI-generated care summary based on patient state
  const aiInsights = buildAIInsights(patient, medications, appointments)

  return (
    <div className="dashboard-hero">
      {/* Texture overlay */}
      <div className="dashboard-hero-texture" aria-hidden />

      {/* Left — Patient identity */}
      <div className="dh-left">
        <div className="dh-avatar-ring">
          <div className="dh-avatar">{initials}</div>
          <div className="dh-status-dot" title="Active recovery monitoring" />
        </div>

        <div className="dh-identity">
          <div className="dh-greeting">Good morning 👋</div>
          <div className="dh-name">
            {patient.first_name} {patient.last_name}
          </div>
          <div className="dh-meta">
            {patient.age && <span>Age {patient.age}</span>}
            {patient.gender && <span aria-hidden>·</span>}
            {patient.gender && <span>{patient.gender}</span>}
            {patient.procedure && <span aria-hidden>·</span>}
            {patient.procedure && <span className="dh-procedure-tag">🦴 {patient.procedure}</span>}
          </div>
        </div>
      </div>

      {/* Center — Recovery status */}
      <div className="dh-center">
        <div className="dh-stage-badge">{stageLabel}</div>

        <div className="dh-progress-section">
          <div className="dh-progress-labels">
            <span className="dh-progress-title">Recovery Progress</span>
            <span className="dh-progress-pct">{progress}%</span>
          </div>
          <div className="dh-progress-bar">
            <div
              className="dh-progress-fill"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Recovery progress: ${progress}%`}
            />
          </div>
          <div className="dh-progress-sub">
            Day {daysSinceDischarge} post-discharge · 12-week program
          </div>
        </div>

        <div className="dh-quick-stats">
          <button
            className="dh-qs-item"
            onClick={() => onNavigate('medications')}
            aria-label={
              hasMedicationAdherence
                ? `Medications: ${completedToday} of ${medicationsTotal} taken`
                : `Active medications: ${medicationsTotal}`
            }
            type="button"
          >
            <span className="dh-qs-icon med">💊</span>
            <span className="dh-qs-val">
              {hasMedicationAdherence ? `${completedToday}/${medicationsTotal}` : medicationsTotal}
            </span>
            <span className="dh-qs-lbl">
              {hasMedicationAdherence ? 'Meds taken' : 'Active meds'}
            </span>
          </button>
          <div className="dh-qs-divider" />
          <button
            className="dh-qs-item"
            onClick={() => onNavigate('appointments')}
            aria-label={`Next appointment: ${nextApptLabel}`}
            type="button"
          >
            <span className="dh-qs-icon appt">📅</span>
            <span className="dh-qs-val">{nextApptLabel}</span>
            <span className="dh-qs-lbl">Next appt</span>
          </button>
          <div className="dh-qs-divider" />
          <button
            className="dh-qs-item"
            onClick={() => onNavigate('symptom-check')}
            aria-label={`Risk level: ${patient.risk_level ?? 'moderate'}`}
            type="button"
          >
            <span className="dh-qs-icon risk">
              {patient.risk_level === 'low' ? '🟢' : patient.risk_level === 'high' ? '🔴' : '🟡'}
            </span>
            <span
              className="dh-qs-val"
              style={{
                color:
                  patient.risk_level === 'low'
                    ? 'var(--green-400)'
                    : patient.risk_level === 'high'
                      ? 'var(--red-400)'
                      : 'var(--amber-400)',
              }}
            >
              {(patient.risk_level ?? 'Moderate').charAt(0).toUpperCase() +
                (patient.risk_level ?? 'moderate').slice(1)}
            </span>
            <span className="dh-qs-lbl">Risk level</span>
          </button>
        </div>
      </div>

      {/* Right — AI insights */}
      <div className="dh-right">
        <div className="dh-ai-header">
          <div className="dh-ai-icon-wrap">
            <span className="dh-ai-icon">⚡</span>
          </div>
          <div>
            <div className="dh-ai-label">AI Care Summary</div>
            <div className="dh-ai-sublabel">Updated just now</div>
          </div>
        </div>

        <div className="dh-ai-insights">
          {aiInsights.map((insight, i) => (
            <div key={i} className={`dh-insight-item ${insight.type}`}>
              <span className="dh-insight-icon">{insight.icon}</span>
              <span className="dh-insight-text">{insight.text}</span>
            </div>
          ))}
        </div>

        <button type="button" className="dh-ask-ai-btn" onClick={() => onNavigate('assistant')}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Ask AI Assistant
        </button>
      </div>
    </div>
  )
}

type InsightType = 'alert' | 'caution' | 'ok' | 'info'

interface Insight {
  icon: string
  text: string
  type: InsightType
}

function buildAIInsights(
  patient: Patient,
  medications: Medication[],
  appointments: Appointment[],
): Insight[] {
  const insights: Insight[] = []

  const pending = medications.filter((m) => !m.taken_today)
  const taken = medications.filter((m) => m.taken_today)

  if (pending.length > 0) {
    insights.push({
      icon: '💊',
      text: `${pending.length} medication${pending.length > 1 ? 's' : ''} still due today`,
      type: 'caution',
    })
  } else if (taken.length > 0) {
    insights.push({
      icon: '✓',
      text: 'All medications taken — great adherence!',
      type: 'ok',
    })
  }

  const nextAppt = appointments
    .filter((a) => a.status !== 'completed')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]

  if (nextAppt) {
    const d = Math.max(
      0,
      Math.ceil((new Date(nextAppt.start).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    )
    const label = d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
    insights.push({
      icon: '📅',
      text: `${nextAppt.title ?? nextAppt.kind} ${label}`,
      type: d <= 1 ? 'info' : 'ok',
    })
  }

  if (patient.risk_level === 'moderate') {
    insights.push({
      icon: '⚡',
      text: 'Moderate risk — log symptoms daily for safety',
      type: 'caution',
    })
  } else if (patient.risk_level === 'low') {
    insights.push({
      icon: '✓',
      text: 'Low risk — recovery on track',
      type: 'ok',
    })
  }

  insights.push({
    icon: '🏃',
    text: dailyActionForCondition(patient.discharge_reason),
    type: 'info',
  })

  return insights.slice(0, 4)
}
