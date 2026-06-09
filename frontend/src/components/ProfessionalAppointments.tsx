import { useState, useEffect } from 'react'
import type { ProfessionalAppointment } from '../types'
import { fetchProfessionalAppointments } from '../api/client'

export function ProfessionalAppointments() {
  const [appointments, setAppointments] = useState<ProfessionalAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('all')

  useEffect(() => {
    async function loadAppointments() {
      try {
        const data = await fetchProfessionalAppointments()
        setAppointments(data)
      } catch (err) {
        console.error('Failed to load clinic appointments', err)
      } finally {
        setLoading(false)
      }
    }
    loadAppointments()
  }, [])

  // Unique list of providers for filter dropdown
  const providers = [
    'all',
    ...Array.from(new Set(appointments.map((a) => a.provider).filter(Boolean) as string[])),
  ]

  const filteredAppointments = appointments.filter((appt) => {
    const matchesSearch =
      appt.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (appt.kind || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesProvider = selectedProvider === 'all' || appt.provider === selectedProvider
    return matchesSearch && matchesProvider
  })

  // Grouping appointments by date category: Today, Tomorrow, Later
  const getGroup = (dateStr: string): 'Today' | 'Tomorrow' | 'Later' => {
    const apptDate = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()

    if (isSameDay(apptDate, today)) return 'Today'
    if (isSameDay(apptDate, tomorrow)) return 'Tomorrow'
    return 'Later'
  }

  const grouped: Record<'Today' | 'Tomorrow' | 'Later', ProfessionalAppointment[]> = {
    Today: [],
    Tomorrow: [],
    Later: [],
  }

  // Sort and group
  filteredAppointments
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach((appt) => {
      grouped[getGroup(appt.start)].push(appt)
    })

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="professional-appointments-view">
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderWidth: 2 }} />
          Loading clinic appointments...
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="col-full">
            {/* Header and Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <h1
                  style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
                >
                  Appointments Schedule
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0 0' }}>
                  Manage clinic-wide patient visits and consultations.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search patient or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--surface-50)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    minWidth: 200,
                  }}
                />

                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--surface-50)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    minWidth: 160,
                  }}
                >
                  {providers.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov === 'all' ? 'All Providers' : prov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List and timeline */}
            {filteredAppointments.length === 0 ? (
              <div
                className="card"
                style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}
              >
                No appointments matched your filters.
              </div>
            ) : (
              (['Today', 'Tomorrow', 'Later'] as const).map((groupName) => {
                const groupItems = grouped[groupName]
                if (groupItems.length === 0) return null

                return (
                  <div key={groupName} style={{ marginBottom: 32 }}>
                    <h2
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: groupName === 'Today' ? 'var(--blue-400)' : 'var(--text-primary)',
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{groupName}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          background:
                            groupName === 'Today'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'var(--surface-100)',
                          color: groupName === 'Today' ? 'var(--blue-400)' : 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        {groupItems.length}
                      </span>
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {groupItems.map((appt) => (
                        <div
                          key={appt.id}
                          className="card"
                          style={{
                            padding: 16,
                            borderLeft:
                              groupName === 'Today'
                                ? '4px solid var(--blue-500)'
                                : '4px solid var(--border-light)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 12,
                            }}
                          >
                            {/* Time and Patient Info */}
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                              <div style={{ textAlign: 'center', minWidth: 70 }}>
                                <div
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {formatTime(appt.start)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginTop: 2,
                                  }}
                                >
                                  {formatDate(appt.start).split(',')[0]}
                                </div>
                              </div>

                              <div
                                style={{
                                  borderLeft: '1px solid var(--border-light)',
                                  height: 40,
                                  alignSelf: 'center',
                                }}
                              ></div>

                              <div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 16,
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {appt.patient_name}
                                  </span>
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    (ID: {appt.patient_id})
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: 14,
                                    color: 'var(--blue-400)',
                                    fontWeight: 500,
                                    marginTop: 4,
                                  }}
                                >
                                  {appt.kind}
                                </div>
                                {appt.reason && (
                                  <p
                                    style={{
                                      fontSize: 13,
                                      color: 'var(--text-muted)',
                                      margin: '6px 0 0 0',
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {appt.reason}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Provider and Location */}
                            <div
                              style={{
                                textAlign: 'right',
                                fontSize: 13,
                                color: 'var(--text-muted)',
                              }}
                            >
                              <div>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {appt.provider}
                                </strong>
                              </div>
                              <div style={{ marginTop: 4 }}>{appt.location}</div>
                              <div style={{ marginTop: 8 }}>
                                <span
                                  className={`badge badge-${appt.status === 'scheduled' || appt.status === 'upcoming' ? 'blue' : appt.status === 'completed' ? 'green' : 'red'}`}
                                >
                                  {appt.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
