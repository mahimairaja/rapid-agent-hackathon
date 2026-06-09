import { useState, useEffect } from 'react'
import type { ProfessionalAppView, Patient, Medication, Appointment } from '../types'
import { loadDashboardData, fetchPatientDashboard, getStoredToken } from '../api/client'
import { PatientCard } from './PatientCard'
import { RecoveryPlan } from './RecoveryPlan'
import { MedicationSchedule } from './MedicationSchedule'
import { AppointmentTimeline } from './AppointmentTimeline'

interface ProfessionalPatientProfileProps {
  patientId: string | null
  onNavigate: (view: ProfessionalAppView, payload?: string) => void
}

export function ProfessionalPatientProfile({ patientId, onNavigate }: ProfessionalPatientProfileProps) {
  const [loading, setLoading] = useState(true)
  const [patientData, setPatientData] = useState<{
    patient: Patient | null
    medications: Medication[]
    appointments: Appointment[]
  }>({
    patient: null,
    medications: [],
    appointments: [],
  })

  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }

    async function loadData() {
      setLoading(true)
      try {
        const token = getStoredToken() || 'demo'
        if (token === 'demo') {
          const data = await loadDashboardData()
          setPatientData(data)
        } else {
          try {
            const data = await fetchPatientDashboard({ patient_code: patientId! }, token)
            setPatientData(data)
          } catch (err) {
            console.warn('Backend endpoint not ready, falling back to mock data', err)
            const data = await loadDashboardData()
            setPatientData(data)
          }
        }
      } catch (err) {
        console.error('Failed to load patient profile', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId])

  if (!patientId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Patient Selected</h2>
        <p>Please select a patient from the queue to view their profile.</p>
        <button 
          type="button" 
          onClick={() => onNavigate('patient-queue')}
          style={{ marginTop: 24, padding: '8px 16px', background: 'var(--blue-500)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Return to Patient Queue
        </button>
      </div>
    )
  }

  if (loading || !patientData.patient) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', borderWidth: 2 }} />
        Loading patient profile...
      </div>
    )
  }

  const { patient, medications, appointments } = patientData

  return (
    <div className="patient-profile-view">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          type="button" 
          onClick={() => onNavigate('patient-profile', undefined)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '8px 12px', 
            background: 'white', 
            border: '1px solid var(--border)', 
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <span>←</span> Back to Directory
        </button>
      </div>

      <PatientCard patient={patient} />

      <div className="dashboard-grid">
        <div className="col-main">
          <div className="view-header" style={{ marginBottom: 16 }}>
            <div className="view-header-title">📋 Recovery Plan</div>
          </div>
          <div className="card">
            <div className="card-accent-bar" />
            <RecoveryPlan />
          </div>

          <div className="view-header" style={{ marginTop: 32, marginBottom: 16 }}>
            <div className="view-header-title">💊 Medication Schedule</div>
          </div>
          <div className="card">
            <div className="card-accent-bar" />
            <div className="card-body" style={{ paddingTop: 20 }}>
              <MedicationSchedule medications={medications} />
            </div>
          </div>
        </div>

        <div className="col-side">
          <div className="view-header" style={{ marginBottom: 16 }}>
            <div className="view-header-title">📅 Appointments</div>
          </div>
          <div className="card">
            <div className="card-accent-bar" />
            <div className="card-body" style={{ paddingTop: 20 }}>
              <AppointmentTimeline appointments={appointments} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
