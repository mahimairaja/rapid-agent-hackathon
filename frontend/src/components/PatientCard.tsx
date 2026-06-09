import type { Patient } from '../types'

interface PatientCardProps {
  patient: Patient
}

const STAGE_LABELS: Record<string, string> = {
  'pre-discharge': 'Pre-Discharge',
  'week-1': 'Week 1 Recovery',
  'week-2': 'Week 2 Recovery',
  'week-3': 'Week 3 Recovery',
  'week-4': 'Week 4 Recovery',
  'month-2': 'Month 2',
  'month-3': 'Month 3',
}

const STAGE_PROGRESS: Record<string, number> = {
  'pre-discharge': 0,
  'week-1': 8,
  'week-2': 20,
  'week-3': 35,
  'week-4': 50,
  'month-2': 70,
  'month-3': 90,
}

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysSince(dateStr: string) {
  const now = new Date()
  const d = new Date(dateStr)
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function PatientCard({ patient }: PatientCardProps) {
  const initials = getInitials(patient.first_name, patient.last_name)
  const stage = patient.recovery_stage ?? 'week-1'
  const progress = STAGE_PROGRESS[stage] ?? 8
  const stageLabel = STAGE_LABELS[stage] ?? 'Recovery'
  const daysSinceDischarge = patient.discharge_date ? daysSince(patient.discharge_date) : 3

  return (
    <div className="patient-card">
      <div className="patient-card-top">
        <div className="patient-info">
          <div className="patient-avatar">{initials}</div>
          <div>
            <div className="patient-name">
              {patient.first_name} {patient.last_name}
            </div>
            <div className="patient-meta">
              {patient.age && `Age ${patient.age}`}
              {patient.gender && ` · ${patient.gender}`}
              {patient.city && ` · ${patient.city}, ${patient.state}`}
            </div>
            {patient.procedure && (
              <div className="patient-procedure">
                <span>🦴</span>
                {patient.procedure}
              </div>
            )}
          </div>
        </div>

        <div className="patient-stats">
          {patient.discharge_date && (
            <div className="patient-stat">
              <div className="patient-stat-value">Day {daysSinceDischarge}</div>
              <div className="patient-stat-label">Post Discharge</div>
            </div>
          )}
          {patient.procedure_date && (
            <div className="patient-stat">
              <div className="patient-stat-value">{formatDate(patient.procedure_date)}</div>
              <div className="patient-stat-label">Surgery Date</div>
            </div>
          )}
          <div className="patient-stat">
            <div className="patient-stat-value">{patient.care_team?.length ?? 3}</div>
            <div className="patient-stat-label">Care Team</div>
          </div>
        </div>
      </div>

      <div className="patient-risk-section">
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'rgb(255 255 255 / 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Risk Assessment
          </div>
          <div className={`risk-badge-large ${patient.risk_level ?? 'moderate'}`}>
            <span>
              {patient.risk_level === 'low'
                ? '🟢'
                : patient.risk_level === 'moderate'
                  ? '🟡'
                  : '🔴'}
            </span>
            {(patient.risk_level ?? 'Moderate').charAt(0).toUpperCase() +
              (patient.risk_level ?? 'moderate').slice(1)}{' '}
            Risk
          </div>
        </div>

        <div className="recovery-progress">
          <div className="recovery-progress-label">
            <span>{stageLabel}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'rgb(255 255 255 / 0.4)' }}>
            Target: 12-week full recovery
          </div>
        </div>
      </div>
    </div>
  )
}
