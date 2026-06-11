import { Check, Circle, Pill, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Medication } from '../types'
import { REASON_FRIENDLY, friendlyReason } from '../data/medicationReasons'

interface MedicationScheduleProps {
  medications: Medication[]
  // Dashboard summary mode: name/dose/schedule only, no reason or cautions.
  compact?: boolean
  // Uploaded-plan profiles have no structured list; their medications live in
  // the document and Maya answers from it.
  uploadedPlan?: boolean
}

const FREQ_LABELS: Record<string, string> = {
  'once-daily': 'Once daily',
  'twice-daily': 'Twice daily',
  'three-times-daily': '3× daily',
  'as-needed': 'As needed',
  bedtime: 'At bedtime',
  'with-meals': 'With meals',
}

export function MedicationSchedule({
  medications,
  compact = false,
  uploadedPlan = false,
}: MedicationScheduleProps) {
  if (medications.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <Pill size={28} />
        </span>
        <p className="empty-state-title">No medication list on this profile</p>
        <p className="empty-state-sub">
          {uploadedPlan
            ? 'Your medications live in your uploaded plan. Ask Maya: "What medications do I take today?"'
            : 'Nothing is on the structured plan yet.'}
        </p>
        {uploadedPlan && !compact && (
          <Link to="/maya" className="btn btn-primary" style={{ marginTop: 12 }}>
            Ask Maya
          </Link>
        )}
      </div>
    )
  }

  const hasAdherence = medications.some((m) => typeof m.taken_today === 'boolean')
  const taken = hasAdherence ? medications.filter((m) => m.taken_today) : []
  const pending = hasAdherence ? medications.filter((m) => m.taken_today === false) : medications

  return (
    <div>
      {/* Summary bar */}
      {!compact && (
        <div
          className="flex items-center justify-between mb-4"
          style={{
            padding: '10px 14px',
            background: 'var(--slate-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {hasAdherence ? "Today's Progress" : 'Active Medications'}
          </span>
          <span
            className="text-sm font-semibold"
            style={{
              color: hasAdherence
                ? taken.length === medications.length
                  ? 'var(--green-500)'
                  : 'var(--amber-500)'
                : 'var(--blue-500)',
            }}
          >
            {hasAdherence ? `${taken.length} / ${medications.length} taken` : medications.length}
          </span>
        </div>
      )}

      {/* Pending first */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--amber-500)',
              marginBottom: 8,
            }}
          >
            {hasAdherence ? 'Due Today' : 'On Plan'}
          </div>
          <div className="medication-list">
            {pending.map((med) => (
              <MedItem key={med.id} med={med} compact={compact} />
            ))}
          </div>
        </div>
      )}

      {/* Taken */}
      {taken.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--green-500)',
              marginBottom: 8,
            }}
          >
            Taken Today
          </div>
          <div className="medication-list">
            {taken.map((med) => (
              <MedItem key={med.id} med={med} compact={compact} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MedItem({ med, compact }: { med: Medication; compact?: boolean }) {
  const freqLabel = med.frequency ? (FREQ_LABELS[med.frequency] ?? med.frequency) : ''
  const status = med.taken_today ? 'taken' : 'pending'

  return (
    <div className={`medication-item ${status}`}>
      <div className={`med-check ${status}`}>
        {med.taken_today ? <Check size={14} /> : <Circle size={12} />}
      </div>
      <div className="med-info">
        <div className="med-name">{med.name}</div>
        <div className="med-detail">
          {med.dosage && <span>{med.dosage}</span>}
          {freqLabel && <span> · {freqLabel}</span>}
          {med.schedule_times && med.schedule_times.length > 0 && (
            <span> · {med.schedule_times.join(', ')}</span>
          )}
        </div>
        {med.purpose && <span className="med-purpose-tag">{med.purpose}</span>}
        {!compact && med.reason && (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">Why you take this:</span>{' '}
            {friendlyReason(med.reason)}
            {REASON_FRIENDLY[med.reason] && (
              <span className="text-muted-foreground/70">{` (${med.reason})`}</span>
            )}
          </p>
        )}
        {!compact && med.instructions && (
          <div
            style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}
          >
            {med.instructions}
          </div>
        )}
        {!compact && med.cautions && med.cautions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {med.cautions.slice(0, 2).map((caution) => (
              <span
                key={caution}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
              >
                <TriangleAlert className="size-3" />
                {caution}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={`med-badge ${status}`}>
        {typeof med.taken_today === 'boolean'
          ? med.taken_today
            ? 'Taken'
            : 'Due'
          : med.schedule_times && med.schedule_times.length > 0
            ? 'Scheduled'
            : 'PRN'}
      </div>
    </div>
  )
}
