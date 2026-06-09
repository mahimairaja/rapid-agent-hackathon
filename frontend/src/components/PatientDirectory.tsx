import { useState, useEffect } from 'react'
import type { PatientQueueItem, ProfessionalAppView } from '../types'
import { fetchPatientDirectory } from '../api/client'

interface PatientDirectoryProps {
  onNavigate: (view: ProfessionalAppView, payload?: string) => void
}

type FilterTab = 'all' | 'active' | 'inactive'

export function PatientDirectory({ onNavigate }: PatientDirectoryProps) {
  const [directory, setDirectory] = useState<PatientQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    async function loadDirectory() {
      try {
        const data = await fetchPatientDirectory()
        setDirectory(data)
      } catch (err) {
        console.error('Failed to load patient directory', err)
      } finally {
        setLoading(false)
      }
    }
    loadDirectory()
  }, [])

  const filteredDirectory = directory.filter((patient) => {
    if (activeTab === 'all') return true
    return patient.status === activeTab
  })

  const formatTime = (iso?: string) => {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="patient-directory-view">
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderWidth: 2 }} />
          Loading patient directory...
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="col-full">
            <div className="auth-tab-switcher" style={{ maxWidth: 400, margin: '0 0 24px 0' }}>
              <button
                type="button"
                className={`auth-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Patients
              </button>
              <button
                type="button"
                className={`auth-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                Active
              </button>
              <button
                type="button"
                className={`auth-tab ${activeTab === 'inactive' ? 'active' : ''}`}
                onClick={() => setActiveTab('inactive')}
              >
                Inactive
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Patient Directory</div>
                  <div className="card-subtitle">Showing {filteredDirectory.length} patients</div>
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
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Risk Status</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Last Activity</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600 }}>Assigned Staff</th>
                      <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirectory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: '40px 24px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                          }}
                        >
                          No patients found in this category.
                        </td>
                      </tr>
                    ) : (
                      filteredDirectory.map((patient) => (
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
                            {patient.status === 'inactive' ? (
                              <span className="badge badge-navy">INACTIVE</span>
                            ) : (
                              <span className="badge badge-blue">ACTIVE</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span
                              className={`badge badge-${patient.risk_level === 'critical' ? 'red' : patient.risk_level === 'high' ? 'amber' : patient.risk_level === 'moderate' ? 'teal' : 'green'}`}
                            >
                              {patient.risk_level.toUpperCase()}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '16px 24px',
                              color: 'var(--text-muted)',
                              fontSize: 14,
                            }}
                          >
                            {formatTime(patient.last_check_in)}
                          </td>
                          <td
                            style={{
                              padding: '16px 24px',
                              color: 'var(--text-muted)',
                              fontSize: 14,
                            }}
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
                      ))
                    )}
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
