import { useState } from 'react'

interface PatientCodeGateProps {
  error?: string
  initialCode?: string | null
  loading: boolean
  onDemoAccess: () => void
  onLogout: () => void
  onSubmit: (patientCode: string) => void
}

export function PatientCodeGate({
  error,
  initialCode,
  loading,
  onDemoAccess,
  onLogout,
  onSubmit,
}: PatientCodeGateProps) {
  const [patientCode, setPatientCode] = useState(initialCode ?? '')
  const trimmed = patientCode.trim()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!trimmed) return
    onSubmit(trimmed.toUpperCase())
  }

  return (
    <div className="patient-code-screen">
      <div className="patient-code-panel">
        <div className="patient-code-logo" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>

        <div className="patient-code-eyebrow">Patient access</div>
        <h1 className="patient-code-title">Connect a discharge plan</h1>
        <p className="patient-code-sub">
          Enter the patient code from the discharge packet to load the dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="patient-code-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="patient-code-input">
              Patient code
            </label>
            <input
              id="patient-code-input"
              className="form-input"
              value={patientCode}
              onChange={(event) => setPatientCode(event.target.value)}
              placeholder="HW-1001"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={!trimmed || loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Loading plan...
              </>
            ) : (
              'Load dashboard'
            )}
          </button>
        </form>

        <button type="button" className="login-demo-btn" onClick={onDemoAccess} disabled={loading}>
          View demo dashboard
        </button>
        <button type="button" className="patient-code-logout" onClick={onLogout} disabled={loading}>
          Sign out
        </button>
      </div>
    </div>
  )
}
