import type { ReactNode } from 'react'
import {
  CalendarDays,
  ClipboardList,
  Footprints,
  Info,
  MapPin,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import type { Appointment } from '../types'

interface AppointmentTimelineProps {
  appointments: Appointment[]
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const KIND_ICONS: Record<string, ReactNode> = {
  physiotherapy: <Footprints size={15} />,
  'nurse-check-in': <UserRound size={15} />,
  'surgeon-review': <Stethoscope size={15} />,
  general: <ClipboardList size={15} />,
}

export function AppointmentTimeline({ appointments }: AppointmentTimelineProps) {
  if (appointments.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <CalendarDays size={28} />
        </span>
        <p className="empty-state-title">No appointments scheduled</p>
      </div>
    )
  }

  // Sort by date ascending
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )

  return (
    <div className="appointment-timeline">
      {sorted.map((appt, idx) => {
        const isUpcoming = idx === 0
        const icon = KIND_ICONS[appt.kind] ?? <ClipboardList size={15} />

        return (
          <div key={appt.id} className="timeline-item">
            {/* Date column */}
            <div className="timeline-time">
              <div className="timeline-date">{formatDateShort(appt.start)}</div>
              <div className="timeline-hour">{formatTime(appt.start)}</div>
            </div>

            {/* Line column */}
            <div className="timeline-line-col">
              <div className={`timeline-dot ${appt.status}`} />
              {idx < sorted.length - 1 && <div className="timeline-connector" />}
            </div>

            {/* Content */}
            <div className="timeline-content">
              <div className={`timeline-card${isUpcoming ? ' upcoming' : ''}`}>
                <div className="timeline-card-title">
                  <span style={{ marginRight: 6 }}>{icon}</span>
                  {appt.title ?? appt.kind}
                </div>
                <div className="timeline-card-meta">
                  {appt.provider && (
                    <span>
                      <UserRound size={12} /> {appt.provider}
                    </span>
                  )}
                  {appt.location && (
                    <span>
                      <MapPin size={12} /> {appt.location}
                    </span>
                  )}
                  {appt.reason && (
                    <span style={{ marginTop: 2, fontStyle: 'italic' }}>{appt.reason}</span>
                  )}
                </div>
                {appt.instructions && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11.5,
                      color: 'var(--blue-400)',
                      background: 'var(--blue-50)',
                      padding: '5px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--blue-100)',
                    }}
                  >
                    <Info size={12} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
                    {appt.instructions}
                  </div>
                )}
                <div className={`timeline-status-badge ${appt.status}`}>
                  {appt.status === 'upcoming'
                    ? '● Next Up'
                    : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
