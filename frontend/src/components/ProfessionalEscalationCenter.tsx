import { useState, useEffect } from 'react'
import type { ProfessionalEscalation, ProfessionalAppView } from '../types'
import { fetchProfessionalEscalations, resolveProfessionalEscalation } from '../api/client'

interface ProfessionalEscalationCenterProps {
  onNavigate: (view: ProfessionalAppView, payload?: string) => void
}

export function ProfessionalEscalationCenter({ onNavigate }: ProfessionalEscalationCenterProps) {
  const [escalations, setEscalations] = useState<ProfessionalEscalation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved'>('open')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadEscalations() {
      try {
        const data = await fetchProfessionalEscalations()
        setEscalations(data)
      } catch (err) {
        console.error('Failed to load escalations', err)
      } finally {
        setLoading(false)
      }
    }
    loadEscalations()
  }, [])

  const handleResolve = async (id: string) => {
    setResolvingId(id)
    try {
      await resolveProfessionalEscalation(id)
      setEscalations(prev => 
        prev.map(esc => esc.id === id ? { ...esc, status: 'resolved' as const } : esc)
      )
    } catch (err) {
      console.error('Failed to resolve escalation', err)
    } finally {
      setResolvingId(null)
    }
  }

  const filteredEscalations = escalations.filter(esc => esc.status === statusFilter)

  const getPriorityBadgeClass = (level: string) => {
    switch (level) {
      case 'critical': return 'badge-red'
      case 'high': return 'badge-amber'
      case 'medium': return 'badge-blue'
      default: return 'badge-navy'
    }
  }

  const getKindLabel = (kind: string) => {
    if (kind === 'symptom_triage') return 'Symptom Triage Alert'
    if (kind === 'pharmacist_question') return 'Pharmacist Action Item'
    return kind.replace('_', ' ')
  }

  const formatTimeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div className="escalation-center-view">
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderWidth: 2 }} />
          Loading escalations...
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="col-full">
            {/* Tabs & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div className="auth-tab-switcher" style={{ maxWidth: 300, margin: 0 }}>
                <button
                  type="button"
                  className={`auth-tab ${statusFilter === 'open' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('open')}
                >
                  Active Alerts
                </button>
                <button
                  type="button"
                  className={`auth-tab ${statusFilter === 'resolved' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('resolved')}
                >
                  Resolved ({escalations.filter(e => e.status === 'resolved').length})
                </button>
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Showing {filteredEscalations.length} escalations
              </div>
            </div>

            {/* List */}
            {filteredEscalations.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No {statusFilter} escalations found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredEscalations.map(esc => (
                  <div 
                    key={esc.id} 
                    className="card" 
                    style={{ 
                      padding: 20, 
                      position: 'relative',
                      borderLeft: esc.status === 'open' 
                        ? `4px solid var(--${esc.level === 'critical' ? 'red-500' : esc.level === 'high' ? 'amber-500' : 'blue-500'})` 
                        : '4px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                      {/* Priority and Source Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span className={`badge ${getPriorityBadgeClass(esc.level)}`}>
                            {esc.level.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {getKindLabel(esc.kind)}
                          </span>
                          <span style={{ color: 'var(--border-light)' }}>•</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {formatTimeAgo(esc.created_at)}
                          </span>
                        </div>

                        {/* Escalation Message */}
                        <p style={{ 
                          fontSize: 15, 
                          color: 'var(--text-primary)', 
                          fontWeight: 500,
                          lineHeight: 1.5,
                          margin: '0 0 16px 0',
                          maxWidth: '700px'
                        }}>
                          {esc.message}
                        </p>

                        {/* Patient info details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Patient:</span>
                          <button
                            type="button"
                            onClick={() => onNavigate('patient-profile', esc.patient_id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--blue-400)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: 14,
                              textDecoration: 'underline',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {esc.patient_name} ({esc.patient_id})
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {esc.status === 'open' && (
                        <button
                          type="button"
                          disabled={resolvingId === esc.id}
                          onClick={() => handleResolve(esc.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--surface-100)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (resolvingId !== esc.id) {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'
                              e.currentTarget.style.color = 'rgb(16, 185, 129)'
                              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (resolvingId !== esc.id) {
                              e.currentTarget.style.background = 'var(--surface-100)'
                              e.currentTarget.style.color = 'var(--text-primary)'
                              e.currentTarget.style.borderColor = 'var(--border-light)'
                            }
                          }}
                        >
                          {resolvingId === esc.id ? (
                            <>
                              <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                              Resolving...
                            </>
                          ) : (
                            <>
                              <span>✓</span> Mark Resolved
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
