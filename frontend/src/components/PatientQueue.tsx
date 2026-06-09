import { useState, useEffect } from 'react'
import type { PatientQueueItem, ProfessionalAppView } from '../types'
import { fetchPatientQueue } from '../api/client'

interface PatientQueueProps {
  onNavigate: (view: ProfessionalAppView, payload?: string) => void
}

export function PatientQueue({ onNavigate }: PatientQueueProps) {
  const [queue, setQueue] = useState<PatientQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadQueue() {
      try {
        const data = await fetchPatientQueue()
        setQueue(data)
      } catch (err) {
        console.error('Failed to load patient queue', err)
      } finally {
        setLoading(false)
      }
    }
    loadQueue()
  }, [])

  const highPriority = queue.filter(
    (p) => p.risk_level === 'critical' || p.risk_level === 'high',
  ).length
  const escalations = queue.filter((p) => p.escalation).length
  // Simple mock metrics
  const followUpsDue = 4
  const recentlyCheckedIn = 12

  const formatTime = (iso?: string) => {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="patient-queue-view">
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderWidth: 2 }} />
          Loading patient queue...
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Summary Cards */}
          <div className="col-full stat-cards">
            <div className="stat-card">
              <div className="stat-card-icon red">🔴</div>
              <div className="stat-card-value">{highPriority}</div>
              <div className="stat-card-label">High Priority</div>
              <div className="stat-card-trend neutral">Requires immediate review</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon amber">🟡</div>
              <div className="stat-card-value">{followUpsDue}</div>
              <div className="stat-card-label">Follow-up Due</div>
              <div className="stat-card-trend neutral">Today's schedule</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon green">🟢</div>
              <div className="stat-card-value">{recentlyCheckedIn}</div>
              <div className="stat-card-label">Checked-In Today</div>
              <div className="stat-card-trend up">↑ On track</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon red">🚨</div>
              <div className="stat-card-value">{escalations}</div>
              <div className="stat-card-label">New Escalations</div>
              <div className="stat-card-trend neutral">From AI Assistant</div>
            </div>
          </div>

          {/* Queue Table */}
          <div className="col-full">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Active Patients</div>
                  <div className="card-subtitle">Showing {queue.length} assigned patients</div>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    minWidth: 800,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Patient Name</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Risk Status</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Last Check-in</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Next Appointment</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Assigned Staff</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((patient) => (
                      <tr
                        key={patient.id}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          transition: 'background 0.2s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--surface-50)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => onNavigate('patient-profile', patient.id)}
                      >
                        <td
                          style={{
                            padding: '16px 24px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--blue-50)',
                                color: 'var(--blue-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {patient.first_name[0]}
                              {patient.last_name[0]}
                            </div>
                            {patient.first_name} {patient.last_name}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span
                            className={`badge badge-${patient.risk_level === 'critical' ? 'red' : patient.risk_level === 'high' ? 'amber' : patient.risk_level === 'moderate' ? 'blue' : 'green'}`}
                          >
                            {patient.risk_level.toUpperCase()}
                          </span>
                        </td>
                        <td
                          style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          {formatTime(patient.last_check_in)}
                        </td>
                        <td
                          style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          {formatTime(patient.next_appointment)}
                        </td>
                        <td
                          style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          {patient.assigned_staff}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigate('patient-profile', patient.id)
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--blue-50)',
                              color: 'var(--blue-600)',
                              border: '1px solid var(--blue-100)',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontSize: 13,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--blue-100)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--blue-50)'
                            }}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
