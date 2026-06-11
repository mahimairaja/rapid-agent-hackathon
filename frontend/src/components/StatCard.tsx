import { CalendarDays, Pill, Target } from 'lucide-react'
import type { Patient } from '../types'

interface StatCardsProps {
  hasMedicationAdherence: boolean
  patient: Patient
  medicationsDue: number
  nextAppointmentDays: number
  nextAppointmentKind?: string | null
  completedToday: number
}

export function StatCards({
  hasMedicationAdherence,
  patient,
  medicationsDue,
  nextAppointmentDays,
  nextAppointmentKind,
  completedToday,
}: StatCardsProps) {
  // Default the stage like the hero/sidebar do, so an onboarded profile
  // (which has no recovery_stage) reads Week 1 everywhere, not 40% here.
  const stage = patient.recovery_stage ?? 'week-1'
  const recoveryPercent =
    stage === 'week-1' ? 8 : stage === 'week-2' ? 18 : stage === 'week-3' ? 28 : 40

  return (
    <div className="stat-cards">
      <div className="stat-card">
        <div className="stat-card-icon blue">
          <Pill size={20} />
        </div>
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
        <div className="stat-card-icon teal">
          <CalendarDays size={20} />
        </div>
        <div className="stat-card-value">
          {nextAppointmentDays === 0
            ? 'Today'
            : nextAppointmentDays === 1
              ? 'Tomorrow'
              : `${nextAppointmentDays}d`}
        </div>
        <div className="stat-card-label">Next Appointment</div>
        <div className="stat-card-trend neutral">{nextAppointmentKind ?? 'None scheduled yet'}</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-icon amber">
          <Target size={20} />
        </div>
        <div className="stat-card-value">{recoveryPercent}%</div>
        <div className="stat-card-label">Recovery Progress</div>
        <div className="stat-card-trend up">↑ On track</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-icon red">⚠️</div>
        <div className="stat-card-value">
          {/* Default matches the sidebar/hero ('moderate'), so the cards never
              disagree with the rest of the shell. */}
          {(patient.risk_level ?? 'moderate') === 'moderate'
            ? 'Mod.'
            : (patient.risk_level ?? 'moderate')}
        </div>
        <div className="stat-card-label">Risk Level</div>
        <div className="stat-card-trend neutral">Monitored daily</div>
      </div>
    </div>
  )
}
