import { useState } from 'react'
import { Droplets, Footprints, Sparkles, Thermometer, Wind, Zap } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SymptomCheckIn, TriageResult } from '../types'

const INITIAL_STATE: SymptomCheckIn = {
  pain_level: 3,
  fever: false,
  swelling: false,
  shortness_of_breath: false,
  wound_discharge: false,
  calf_swelling: false,
  notes: '',
}

function assessTriage(s: SymptomCheckIn): TriageResult {
  const isUrgent =
    s.fever || s.shortness_of_breath || s.wound_discharge || s.pain_level >= 8 || s.calf_swelling

  const isCaution = !isUrgent && (s.swelling || s.pain_level >= 5)

  if (isUrgent) {
    const actions: string[] = []
    if (s.shortness_of_breath)
      actions.push(
        'Call 911 immediately — shortness of breath after joint surgery may indicate a pulmonary embolism.',
      )
    if (s.calf_swelling)
      actions.push('Seek emergency care — calf swelling may indicate deep vein thrombosis (DVT).')
    if (s.fever)
      actions.push('Call Nurse Emily Rodriguez: (555) 204-1102 — Fever can indicate infection.')
    if (s.wound_discharge)
      actions.push('Contact care team immediately — wound discharge needs urgent assessment.')
    if (s.pain_level >= 8)
      actions.push('Take Acetaminophen if due, apply ice, and contact your nurse within 1 hour.')
    if (actions.length === 0) actions.push('Contact your care team at (555) 204-1102 immediately.')

    return {
      level: 'urgent',
      title: 'Urgent — Contact Care Team Now',
      message:
        'Based on your symptoms, you need to contact your care team right away. Do not wait.',
      actions,
    }
  }

  if (isCaution) {
    return {
      level: 'caution',
      title: 'Monitor Closely',
      message: 'Your symptoms are manageable but need watching. Follow these steps:',
      actions: [
        s.swelling ? 'Apply ice for 20 minutes to reduce swelling.' : '',
        s.pain_level >= 5 ? 'Take Acetaminophen as scheduled if pain continues.' : '',
        'Rest and elevate your operated leg above heart level when sitting.',
        'Log your symptoms in this tool every 4–6 hours.',
        'Contact Nurse Emily if symptoms worsen: (555) 204-1102',
      ].filter(Boolean),
    }
  }

  return {
    level: 'stable',
    title: 'Stable — Keep it Up',
    message: "Your symptoms look manageable for Week 1 recovery. Here's what to continue:",
    actions: [
      'Continue short assisted walks (10–15 min, 3× daily).',
      'Do hourly ankle pumps to prevent blood clots.',
      'Take your medications as scheduled.',
      'Keep the wound site clean and dry.',
      'Rest well — recovery happens during sleep.',
    ],
  }
}

function composeReport(s: SymptomCheckIn): string {
  const symptoms: string[] = []
  if (s.fever) symptoms.push('a fever')
  if (s.swelling) symptoms.push('swelling')
  if (s.shortness_of_breath) symptoms.push('shortness of breath')
  if (s.wound_discharge) symptoms.push('discharge from my wound')
  if (s.calf_swelling) symptoms.push('calf pain and swelling')
  const parts = [`my pain level is ${s.pain_level}/10`]
  if (symptoms.length) parts.push(`I have ${symptoms.join(', ')}`)
  if (s.notes.trim()) parts.push(s.notes.trim())
  return `Symptom check-in: ${parts.join('. ')}.`
}

interface SymptomCheckInFormProps {
  // When provided, submissions go to Maya's live conversation (real triage,
  // check-in/escalation records) instead of the local mock assessment.
  onSubmitReport?: (text: string) => void
}

const TOGGLES: Array<{
  field: keyof Omit<SymptomCheckIn, 'pain_level' | 'notes'>
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { field: 'fever', label: 'Fever', hint: '38.5°C or higher', icon: Thermometer },
  { field: 'swelling', label: 'Hip / leg swelling', hint: 'Around the joint', icon: Footprints },
  {
    field: 'shortness_of_breath',
    label: 'Shortness of breath',
    hint: 'At rest or sudden',
    icon: Wind,
  },
  { field: 'wound_discharge', label: 'Wound discharge', hint: 'Fluid or redness', icon: Droplets },
  {
    field: 'calf_swelling',
    label: 'Calf pain / swelling',
    hint: 'One-sided tenderness',
    icon: Zap,
  },
]

function painTone(level: number): { badge: string; track: string; label: string } {
  if (level <= 3)
    return { badge: 'bg-secondary/15 text-secondary', track: 'bg-secondary', label: 'Mild' }
  if (level <= 6)
    return { badge: 'bg-amber-100 text-amber-600', track: 'bg-amber-500', label: 'Moderate' }
  return { badge: 'bg-destructive/10 text-destructive', track: 'bg-destructive', label: 'Severe' }
}

export function SymptomCheckInForm({ onSubmitReport }: SymptomCheckInFormProps) {
  const [form, setForm] = useState<SymptomCheckIn>(INITIAL_STATE)
  const [result, setResult] = useState<TriageResult | null>(null)

  const tone = painTone(form.pain_level)

  const toggle = (field: keyof Omit<SymptomCheckIn, 'pain_level' | 'notes'>) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmitReport) {
      onSubmitReport(composeReport(form))
      setForm(INITIAL_STATE)
      return
    }
    setResult(assessTriage(form))
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const handleReset = () => {
    setForm(INITIAL_STATE)
    setResult(null)
  }

  return (
    <form className="flex flex-col gap-7" onSubmit={handleSubmit}>
      {/* Pain slider */}
      <section>
        <div className="mb-0.5 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">How bad is your pain?</h3>
          <span
            className={cn(
              'flex shrink-0 items-baseline gap-1.5 rounded-full px-3 py-1 text-sm font-bold',
              tone.badge,
            )}
          >
            {form.pain_level}/10
            <span className="text-xs font-semibold opacity-80">{tone.label}</span>
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Slide to where it feels right now</p>
        <Slider
          id="pain-level-slider"
          min={0}
          max={10}
          step={1}
          value={[form.pain_level]}
          onValueChange={([v]) => setForm((prev) => ({ ...prev, pain_level: v }))}
          className="py-2"
          aria-label="Current pain level"
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>0 · No pain</span>
          <span>5 · Moderate</span>
          <span>10 · Worst imaginable</span>
        </div>
      </section>

      {/* Symptom toggle cards */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Anything else going on?{' '}
          <span className="font-normal text-muted-foreground">Tap all that apply</span>
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOGGLES.map(({ field, label, hint, icon: Icon }, i) => {
            const active = form[field]
            return (
              <button
                key={field}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggle(field)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                  i === TOGGLES.length - 1 && 'sm:col-span-2',
                  active
                    ? 'border-primary bg-accent ring-1 ring-primary/40'
                    : 'border-border bg-card hover:border-input hover:shadow-sm',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {label}
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Notes */}
      <section>
        <label htmlFor="symptom-notes" className="mb-2 block text-sm font-semibold text-foreground">
          Anything you want Maya to know?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="symptom-notes"
          placeholder="Describe how you're feeling in your own words…"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className="min-h-24 resize-none bg-card"
        />
      </section>

      {/* Submit */}
      <div className="flex gap-2">
        <Button id="symptom-submit-btn" type="submit" size="lg" className="flex-1 gap-2">
          {onSubmitReport && <Sparkles className="size-4" aria-hidden="true" />}
          {onSubmitReport ? 'Send to Maya' : 'Assess Symptoms'}
        </Button>
        {result && (
          <Button type="button" variant="outline" size="lg" onClick={handleReset}>
            Reset
          </Button>
        )}
      </div>

      {/* Result (local mock fallback only; the live path replies in Maya) */}
      {result && (
        <div className={`triage-result ${result.level}`}>
          <div className="triage-result-header">{result.title}</div>
          <div className="triage-result-body">{result.message}</div>
          <div className="triage-actions">
            {result.actions.map((action, i) => (
              <div key={i} className="triage-action">
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Maya shares guidance from your care plan, not medical advice. In an emergency, call{' '}
        <strong>911</strong>.
      </p>
    </form>
  )
}
