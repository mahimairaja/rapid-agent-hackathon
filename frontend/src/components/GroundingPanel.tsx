import { useMemo } from 'react'
import type { SessionContext, SourceItem } from '../types'

interface GroundingPanelProps {
  context: SessionContext | null
  highlights: SourceItem[]
  loading: boolean
}

function timeKey(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * "What I know about you" — the verified patient's plan, medications,
 * appointments, and care-plan chunks for the live session. On each `sources`
 * frame it highlights the exact items an answer was grounded in, so the demo
 * shows where each reply comes from.
 */
export function GroundingPanel({ context, highlights, loading }: GroundingPanelProps) {
  const highlight = useMemo(() => {
    const medNames = new Set<string>()
    const apptTimes = new Set<number>()
    const apptKinds = new Set<string>()
    const planChunks = new Set<string>()
    let plan = false
    for (const s of highlights) {
      if (s.type === 'medication' && s.name) medNames.add(s.name.toLowerCase())
      if (s.type === 'appointment') {
        const t = timeKey(s.start_iso)
        if (t !== null) apptTimes.add(t)
        if (s.kind) apptKinds.add(s.kind.toLowerCase())
      }
      if (s.type === 'care_plan' && s.source_file !== undefined) {
        planChunks.add(`${s.source_file}#${s.chunk_index}`)
      }
      if (s.type === 'plan' || s.type === 'identity') plan = true
    }
    return { medNames, apptTimes, apptKinds, planChunks, plan }
  }, [highlights])

  if (!context?.verified || !context.patient) {
    return (
      <aside className="grounding-panel" aria-label="What I know about you">
        <div className="grounding-header">
          <span className="grounding-title">What I know about you</span>
        </div>
        <div className="grounding-placeholder">
          {loading
            ? 'Loading your plan…'
            : 'Tell me who you are (your name and date of birth, or your patient code) to load your plan.'}
        </div>
      </aside>
    )
  }

  const p = context.patient
  const meds = context.medications ?? []
  const appts = context.appointments ?? []
  const chunks = context.care_plan?.chunks ?? []

  const apptHighlighted = (kind: string, start: string) => {
    const t = timeKey(start)
    return (
      (t !== null && highlight.apptTimes.has(t)) ||
      highlight.apptKinds.has((kind || '').toLowerCase())
    )
  }

  return (
    <aside className="grounding-panel" aria-label="What I know about you">
      <div className="grounding-header">
        <span className="grounding-title">What I know about you</span>
        <span className="badge badge-green">Verified</span>
      </div>

      <section className={`grounding-card${highlight.plan ? ' is-highlighted' : ''}`}>
        <div className="grounding-patient-name">
          {p.first_name} {p.last_name}
        </div>
        {p.discharge_reason && <div className="grounding-line">🩺 {p.discharge_reason}</div>}
        {p.assigned_clinician && <div className="grounding-line">👩‍⚕️ {p.assigned_clinician}</div>}
      </section>

      {meds.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">💊 Medications</div>
          {meds.map((m) => (
            <div
              key={m.id}
              className={`grounding-item${
                highlight.medNames.has((m.name || '').toLowerCase()) ? ' is-highlighted' : ''
              }`}
            >
              <span className="grounding-item-name">{m.name}</span>
              {m.dosage && <span className="grounding-item-sub">{m.dosage}</span>}
            </div>
          ))}
        </section>
      )}

      {appts.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">📅 Appointments</div>
          {appts.map((a) => (
            <div
              key={a.id}
              className={`grounding-item${
                apptHighlighted(a.kind, a.start) ? ' is-highlighted' : ''
              }`}
            >
              <span className="grounding-item-name">{a.kind}</span>
              <span className="grounding-item-sub">
                {new Date(a.start).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </section>
      )}

      {chunks.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">📋 Care plan</div>
          {chunks.map((c) => (
            <div
              key={`${c.source_file}#${c.chunk_index}`}
              className={`grounding-chunk${
                highlight.planChunks.has(`${c.source_file}#${c.chunk_index}`)
                  ? ' is-highlighted'
                  : ''
              }`}
            >
              {c.text}
            </div>
          ))}
        </section>
      )}
    </aside>
  )
}
