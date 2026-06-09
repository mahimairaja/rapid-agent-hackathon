import { useState } from 'react';
import type { SymptomCheckIn, TriageResult } from '../types';

const INITIAL_STATE: SymptomCheckIn = {
  pain_level: 3,
  fever: false,
  swelling: false,
  shortness_of_breath: false,
  wound_discharge: false,
  calf_swelling: false,
  notes: '',
};

function assessTriage(s: SymptomCheckIn): TriageResult {
  const isUrgent =
    s.fever ||
    s.shortness_of_breath ||
    s.wound_discharge ||
    s.pain_level >= 8 ||
    s.calf_swelling;

  const isCaution = !isUrgent && (s.swelling || s.pain_level >= 5);

  if (isUrgent) {
    const actions: string[] = [];
    if (s.shortness_of_breath) actions.push('🚨 Call 911 immediately — shortness of breath after joint surgery may indicate a pulmonary embolism.');
    if (s.calf_swelling) actions.push('🚨 Seek emergency care — calf swelling may indicate deep vein thrombosis (DVT).');
    if (s.fever) actions.push('📞 Call Nurse Emily Rodriguez: (555) 204-1102 — Fever can indicate infection.');
    if (s.wound_discharge) actions.push('📞 Contact care team immediately — wound discharge needs urgent assessment.');
    if (s.pain_level >= 8) actions.push('💊 Take Acetaminophen if due, apply ice, and contact your nurse within 1 hour.');
    if (actions.length === 0) actions.push('📞 Contact your care team at (555) 204-1102 immediately.');

    return {
      level: 'urgent',
      title: '⚠️ Urgent — Contact Care Team Now',
      message: 'Based on your symptoms, you need to contact your care team right away. Do not wait.',
      actions,
    };
  }

  if (isCaution) {
    return {
      level: 'caution',
      title: '⚡ Monitor Closely',
      message: 'Your symptoms are manageable but need watching. Follow these steps:',
      actions: [
        s.swelling ? '🧊 Apply ice for 20 minutes to reduce swelling.' : '',
        s.pain_level >= 5 ? '💊 Take Acetaminophen as scheduled if pain continues.' : '',
        'Rest and elevate your operated leg above heart level when sitting.',
        'Log your symptoms in this tool every 4–6 hours.',
        'Contact Nurse Emily if symptoms worsen: (555) 204-1102',
      ].filter(Boolean),
    };
  }

  return {
    level: 'stable',
    title: '✓ Stable — Keep it Up',
    message: "Your symptoms look manageable for Week 1 recovery. Here's what to continue:",
    actions: [
      'Continue short assisted walks (10–15 min, 3× daily).',
      'Do hourly ankle pumps to prevent blood clots.',
      'Take your medications as scheduled.',
      'Keep the wound site clean and dry.',
      'Rest well — recovery happens during sleep.',
    ],
  };
}

export function SymptomCheckInForm() {
  const [form, setForm] = useState<SymptomCheckIn>(INITIAL_STATE);
  const [result, setResult] = useState<TriageResult | null>(null);

  const painColor = form.pain_level <= 3 ? 'low' : form.pain_level <= 6 ? 'medium' : 'high';

  const toggle = (field: keyof Omit<SymptomCheckIn, 'pain_level' | 'notes'>) => {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(assessTriage(form));
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleReset = () => {
    setForm(INITIAL_STATE);
    setResult(null);
  };

  const TOGGLES: Array<{ field: keyof Omit<SymptomCheckIn, 'pain_level' | 'notes'>; label: string; emoji: string }> = [
    { field: 'fever', label: 'Fever (≥38.5°C)', emoji: '🌡️' },
    { field: 'swelling', label: 'Hip/Leg Swelling', emoji: '🦵' },
    { field: 'shortness_of_breath', label: 'Shortness of Breath', emoji: '🫁' },
    { field: 'wound_discharge', label: 'Wound Discharge', emoji: '🩹' },
    { field: 'calf_swelling', label: 'Calf Pain/Swelling', emoji: '⚡' },
  ];

  return (
    <form className="symptom-form" onSubmit={handleSubmit}>
      {/* Pain slider */}
      <div className="symptom-pain-slider">
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Current Pain Level
        </label>
        <div className="pain-level-display">
          <span className={`pain-number ${painColor}`}>{form.pain_level}</span>
          <div style={{ flex: 1 }}>
            <input
              id="pain-level-slider"
              type="range"
              min={0}
              max={10}
              value={form.pain_level}
              onChange={e => setForm(prev => ({ ...prev, pain_level: Number(e.target.value) }))}
            />
            <div className="pain-slider-labels">
              <span>0 – No pain</span>
              <span>5 – Moderate</span>
              <span>10 – Worst</span>
            </div>
          </div>
        </div>
      </div>

      {/* Symptom toggles */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
          Symptoms Present?
        </label>
        <div className="symptom-toggles">
          {TOGGLES.map(({ field, label, emoji }) => (
            <div
              key={field}
              className={`symptom-toggle-item${form[field] ? ' active' : ''}`}
              onClick={() => toggle(field)}
              role="checkbox"
              aria-checked={form[field]}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && toggle(field)}
            >
              <div className="symptom-toggle-checkbox">
                {form[field] && (
                  <svg width="10" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="symptom-toggle-label">
                <span>{emoji}</span> {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="symptom-notes">
        <label htmlFor="symptom-notes">Additional Notes (optional)</label>
        <textarea
          id="symptom-notes"
          placeholder="Describe how you're feeling…"
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-2">
        <button id="symptom-submit-btn" type="submit" className="btn btn-primary" style={{ flex: 1 }}>
          Assess Symptoms
        </button>
        {result && (
          <button type="button" className="btn btn-outline" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`triage-result ${result.level}`}>
          <div className="triage-result-header">{result.title}</div>
          <div className="triage-result-body">{result.message}</div>
          <div className="triage-actions">
            {result.actions.map((action, i) => (
              <div key={i} className="triage-action">{action}</div>
            ))}
          </div>
        </div>
      )}

      {/* Medical disclaimer */}
      <div className="medical-disclaimer">
        ⚕️ <strong>Medical Disclaimer:</strong> This tool provides general recovery guidance based on your care plan. It does not replace professional medical advice. For medical emergencies, call <strong>911</strong> immediately.
      </div>
    </form>
  );
}
