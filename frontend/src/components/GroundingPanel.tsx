import { useEffect, useMemo, useRef } from 'react'
import type { SessionContext, SourceItem } from '../types'

interface GroundingPanelProps {
  context: SessionContext | null
  highlights: SourceItem[]
  // Bumped on every sources frame: replays the pulse animation (highlighted
  // items are keyed by it) and triggers the scroll-to-highlight.
  highlightTick: number
  loading: boolean
}

function timeKey(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Render a care-plan chunk's markdown as safe HTML. The chunk text is
 * HTML-escaped FIRST, then only our own tags are introduced (headings, lists,
 * bold, paragraphs) — same approach as the chat bubble renderer.
 */
function renderCarePlanMarkdown(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const blocks = escaped.split(/\n{2,}/)
  const html = blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim() !== '')
      if (lines.length === 0) return ''
      // A block of list items becomes one list; stray text lines stay inline.
      if (lines.every((l) => l.trim().startsWith('- '))) {
        const items = lines.map((l) => `<li>${l.trim().slice(2)}</li>`).join('')
        return `<ul>${items}</ul>`
      }
      return lines
        .map((line) => {
          const trimmed = line.trim()
          if (trimmed.startsWith('### ')) return `<h6>${trimmed.slice(4)}</h6>`
          if (trimmed.startsWith('## ')) return `<h5>${trimmed.slice(3)}</h5>`
          if (trimmed.startsWith('# ')) return `<h4>${trimmed.slice(2)}</h4>`
          if (trimmed.startsWith('- ')) return `<ul><li>${trimmed.slice(2)}</li></ul>`
          return `<p>${trimmed}</p>`
        })
        .join('')
    })
    .join('')

  return html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

/**
 * "What I know about you" — the verified patient's plan, medications,
 * appointments, and care-plan chunks for the live session. On each `sources`
 * frame it highlights the exact items an answer was grounded in, so the demo
 * shows where each reply comes from.
 */
export function GroundingPanel({
  context,
  highlights,
  highlightTick,
  loading,
}: GroundingPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)

  // Bring the cited item into view each time a new sources frame lands, so
  // the grounding is visible even when the panel is scrolled elsewhere.
  useEffect(() => {
    if (highlightTick === 0) return
    panelRef.current
      ?.querySelector('.is-highlighted')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [highlightTick])

  const highlight = useMemo(() => {
    const medNames = new Set<string>()
    const apptTimes = new Set<number>()
    const planChunks = new Set<string>()
    let plan = false
    for (const s of highlights) {
      if (s.type === 'medication' && s.name) medNames.add(s.name.toLowerCase())
      // Match an appointment by its exact start instant only. The backend always
      // emits start_iso, and kind (e.g. "Follow-up") is not unique per visit, so
      // matching on kind would wrongly highlight every same-kind appointment.
      if (s.type === 'appointment') {
        const t = timeKey(s.start_iso)
        if (t !== null) apptTimes.add(t)
      }
      if (s.type === 'care_plan' && s.source_file !== undefined) {
        planChunks.add(`${s.source_file}#${s.chunk_index}`)
      }
      if (s.type === 'plan' || s.type === 'identity') plan = true
    }
    return { medNames, apptTimes, planChunks, plan }
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

  const apptHighlighted = (start: string) => {
    const t = timeKey(start)
    return t !== null && highlight.apptTimes.has(t)
  }

  // Highlighted items carry the tick in their key, so each new sources frame
  // remounts them and the pulse animation replays.
  const hlKey = (base: string, isHighlighted: boolean) =>
    isHighlighted ? `${base}-h${highlightTick}` : base

  return (
    <aside className="grounding-panel" aria-label="What I know about you" ref={panelRef}>
      <div className="grounding-header">
        <span className="grounding-title">What I know about you</span>
        <span className="badge badge-green">Verified</span>
      </div>

      <section
        key={hlKey('patient-card', highlight.plan)}
        className={`grounding-card${highlight.plan ? ' is-highlighted' : ''}`}
      >
        <div className="grounding-patient-name">
          {p.first_name} {p.last_name}
        </div>
        {p.discharge_reason && <div className="grounding-line">🩺 {p.discharge_reason}</div>}
        {p.assigned_clinician && <div className="grounding-line">👩‍⚕️ {p.assigned_clinician}</div>}
      </section>

      {meds.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">💊 Medications</div>
          {meds.map((m) => {
            const isHl = highlight.medNames.has((m.name || '').toLowerCase())
            return (
              <div
                key={hlKey(m.id, isHl)}
                className={`grounding-item${isHl ? ' is-highlighted' : ''}`}
              >
                <span className="grounding-item-name">{m.name}</span>
                {m.dosage && <span className="grounding-item-sub">{m.dosage}</span>}
              </div>
            )
          })}
        </section>
      )}

      {appts.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">📅 Appointments</div>
          {appts.map((a) => {
            const isHl = apptHighlighted(a.start)
            return (
              <div
                key={hlKey(a.id, isHl)}
                className={`grounding-item${isHl ? ' is-highlighted' : ''}`}
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
            )
          })}
        </section>
      )}

      {chunks.length > 0 && (
        <section className="grounding-section">
          <div className="grounding-section-title">📋 Care plan</div>
          {chunks.map((c) => {
            const id = `${c.source_file}#${c.chunk_index}`
            const isHl = highlight.planChunks.has(id)
            return (
              <div
                key={hlKey(id, isHl)}
                className={`grounding-chunk grounding-chunk-md${isHl ? ' is-highlighted' : ''}`}
                dangerouslySetInnerHTML={{ __html: renderCarePlanMarkdown(c.text) }}
              />
            )
          })}
        </section>
      )}
    </aside>
  )
}
