import type { Patient } from '../types'

interface StatCardsProps {
  hasMedicationAdherence: boolean
  patient: Patient
  medicationsDue: number
  nextAppointmentDays: number
  completedToday: number
}

export function StatCards({
  hasMedicationAdherence,
  patient,
  medicationsDue,
  nextAppointmentDays,
  completedToday,
}: StatCardsProps) {
  const recoveryPercent =
    patient.recovery_stage === 'week-1'
      ? 8
      : patient.recovery_stage === 'week-2'
        ? 18
        : patient.recovery_stage === 'week-3'
          ? 28
          : 40

  return (
    <div className="stat-cards">
      <div className="stat-card">
        <div className="stat-card-icon blue">💊</div>
        <div className="stat-card-value">{medicationsDue}</div>
        <div className="stat-card-label">
          {hasMedicationAdherence ? 'Medications Due Today' : 'Active Medications'}
        </div>
        <div className="stat-card-trend neutral">
          {hasMedicationAdherence
            ? `${completedToday} of ${medicationsDue + completedToday} taken`
            : 'From discharge plan'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-icon teal">📅</div>
        <div className="stat-card-value">
          {nextAppointmentDays === 0
            ? 'Today'
            : nextAppointmentDays === 1
              ? 'Tomorrow'
              : `${nextAppointmentDays}d`}
        </div>
        <div className="stat-card-label">Next Appointment</div>
        <div className="stat-card-trend neutral">Physiotherapy follow-up</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-icon amber">🎯</div>
        <div className="stat-card-value">{recoveryPercent}%</div>
        <div className="stat-card-label">Recovery Progress</div>
        <div className="stat-card-trend up">↑ On track</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-icon red">⚠️</div>
        <div className="stat-card-value">
          {patient.risk_level === 'moderate' ? 'Mod.' : (patient.risk_level ?? 'Low')}
        </div>
        <div className="stat-card-label">Risk Level</div>
        <div className="stat-card-trend neutral">Monitored daily</div>
      </div>
    </div>
  )
}
