import type { Patient, Medication, Appointment, CareTeamMember } from '../types'

// ── Care Team ─────────────────────────────────────────────────────────────────

export const MOCK_CARE_TEAM: CareTeamMember[] = [
  {
    id: 'ct-1',
    name: 'Dr. Sarah Chen',
    role: 'Orthopedic Surgeon',
    phone: '(555) 204-1100',
    email: 'dr.chen@rapidhealth.ca',
  },
  {
    id: 'ct-2',
    name: 'Nurse Emily Rodriguez',
    role: 'Recovery Nurse',
    phone: '(555) 204-1102',
    email: 'e.rodriguez@rapidhealth.ca',
  },
  {
    id: 'ct-3',
    name: 'Mark Patel',
    role: 'Physiotherapist',
    phone: '(555) 204-1108',
    email: 'm.patel@rapidhealth.ca',
  },
]

// ── Patient ───────────────────────────────────────────────────────────────────

export const MOCK_PATIENT: Patient = {
  id: 'patient-001',
  patient_id: 'PT-2026-001',
  first_name: 'John',
  last_name: 'Matthews',
  age: 64,
  gender: 'Male',
  birth_date: '1961-11-04',
  city: 'Vancouver',
  state: 'BC',
  phone: '(604) 555-0192',
  email: 'john.matthews@email.com',
  procedure: 'Total Hip Replacement (Right)',
  procedure_date: '2026-06-02',
  discharge_date: '2026-06-05',
  risk_level: 'moderate',
  recovery_stage: 'week-1',
  care_team: MOCK_CARE_TEAM,
  allergies: ['Penicillin', 'Sulfa drugs'],
  conditions: ['Type 2 Diabetes', 'Hypertension'],
}

// ── Medications ───────────────────────────────────────────────────────────────

export const MOCK_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    patient_id: 'patient-001',
    name: 'Acetaminophen',
    dosage: '500mg',
    frequency: 'three-times-daily',
    purpose: 'Pain Management',
    instructions: 'Take with food. Do not exceed 3g per day.',
    start: '2026-06-05',
    taken_today: true,
    reason: 'Post-operative pain relief',
  },
  {
    id: 'med-2',
    patient_id: 'patient-001',
    name: 'Apixaban (Eliquis)',
    dosage: '2.5mg',
    frequency: 'twice-daily',
    purpose: 'Blood Clot Prevention',
    instructions: 'Take at the same times each day. Do not skip doses.',
    start: '2026-06-05',
    taken_today: true,
    reason: 'DVT prophylaxis post-hip replacement',
  },
  {
    id: 'med-3',
    patient_id: 'patient-001',
    name: 'Celecoxib',
    dosage: '200mg',
    frequency: 'twice-daily',
    purpose: 'Anti-inflammatory',
    instructions: 'Take with food or milk. Avoid NSAIDs.',
    start: '2026-06-05',
    taken_today: false,
    reason: 'Post-surgical inflammation',
  },
  {
    id: 'med-4',
    patient_id: 'patient-001',
    name: 'Pantoprazole',
    dosage: '40mg',
    frequency: 'once-daily',
    purpose: 'Stomach Protection',
    instructions: 'Take 30 minutes before breakfast.',
    start: '2026-06-05',
    taken_today: false,
    reason: 'Gastroprotection while on Celecoxib',
  },
]

// ── Appointments ──────────────────────────────────────────────────────────────

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    patient_id: 'patient-001',
    kind: 'physiotherapy',
    title: 'Physiotherapy Follow-up',
    start: '2026-06-10T10:00:00',
    end: '2026-06-10T10:45:00',
    provider: 'Mark Patel, Physiotherapist',
    location: 'Rapid Health Rehab Centre, Room 3A',
    reason: 'Week 1 gait assessment and exercise progression',
    status: 'upcoming',
    instructions: 'Wear comfortable, loose-fitting clothes. Bring your walker.',
  },
  {
    id: 'appt-2',
    patient_id: 'patient-001',
    kind: 'nurse-check-in',
    title: 'Nurse Check-in Call',
    start: '2026-06-11T14:00:00',
    end: '2026-06-11T14:20:00',
    provider: 'Nurse Emily Rodriguez',
    location: 'Telephone / Video Call',
    reason: 'Wound assessment, vital monitoring, medication review',
    status: 'scheduled',
    instructions: 'Have your medication list ready and check your wound site before the call.',
  },
  {
    id: 'appt-3',
    patient_id: 'patient-001',
    kind: 'surgeon-review',
    title: 'Surgeon Review',
    start: '2026-06-17T09:30:00',
    end: '2026-06-17T10:00:00',
    provider: 'Dr. Sarah Chen',
    location: 'Rapid Health Orthopaedics, Suite 402',
    reason: 'Post-operative 2-week X-ray and wound review',
    status: 'scheduled',
    instructions: 'Bring all current medications and your recovery journal.',
  },
  {
    id: 'appt-4',
    patient_id: 'patient-001',
    kind: 'physiotherapy',
    title: 'Physiotherapy – Session 2',
    start: '2026-06-14T11:00:00',
    end: '2026-06-14T11:45:00',
    provider: 'Mark Patel, Physiotherapist',
    location: 'Rapid Health Rehab Centre, Room 3A',
    reason: 'Progressive mobility training',
    status: 'scheduled',
  },
]

// ── Recovery Plan ─────────────────────────────────────────────────────────────

export interface RecoveryMilestone {
  id: string
  week: string
  title: string
  goals: string[]
  restrictions: string[]
  completed: boolean
}

export const MOCK_RECOVERY_MILESTONES: RecoveryMilestone[] = [
  {
    id: 'ms-1',
    week: 'Week 1',
    title: 'Early Recovery & Wound Care',
    goals: [
      'Short assisted walks (10–15 min, 3×/day)',
      'Ankle pumps and leg exercises every hour',
      'Sleep with pillow between knees',
      'Ice hip 20 min on/off to reduce swelling',
    ],
    restrictions: [
      'No stairs (use ground floor)',
      'Do not cross legs or turn foot inward',
      'No driving',
      'No bending hip past 90 degrees',
    ],
    completed: false,
  },
  {
    id: 'ms-2',
    week: 'Week 2–3',
    title: 'Increasing Mobility',
    goals: [
      'Progress from walker to crutches',
      'Longer walks on flat surfaces',
      'Stair practice with physiotherapist',
    ],
    restrictions: ['Still no bending hip past 90°', 'Avoid low chairs or sofas'],
    completed: false,
  },
  {
    id: 'ms-3',
    week: 'Week 4–6',
    title: 'Active Rehabilitation',
    goals: [
      'Independent walking with aid',
      'Gentle stretching exercises',
      'Return to light activities',
    ],
    restrictions: ['No impact sports', 'No swimming pools (wound must be fully healed)'],
    completed: false,
  },
]

// ── Urgent Warning Signs ──────────────────────────────────────────────────────

export const URGENT_WARNING_SIGNS = [
  { icon: '🌡️', label: 'Fever above 38.5°C (101.3°F)' },
  { icon: '❤️', label: 'Chest pain or palpitations' },
  { icon: '🫁', label: 'Shortness of breath' },
  { icon: '🦵', label: 'Severe calf pain or swelling' },
  { icon: '🩹', label: 'Wound redness, discharge, or opening' },
  { icon: '⚡', label: 'Sudden severe pain increase' },
]

// ── Simulated AI Responses ────────────────────────────────────────────────────

export const AI_RESPONSES: Record<string, string> = {
  stairs: `**Not recommended this week.** Based on your Week 1 post-discharge plan, you should avoid stairs as much as possible. Your recovery protocol requires ground-floor movement only until your Week 2 physiotherapy assessment.

If stairs are unavoidable, use the handrail firmly, lead with your **non-operated leg** going up, and your **operated leg** going down.

👉 Ask Mark Patel about stair training at your physio session on June 10.`,

  pain: `A pain level of 8/10 is significant. Here's what to do:

1. **Take your Acetaminophen** now if it has been 4+ hours since your last dose.
2. **Ice your hip** for 20 minutes to reduce inflammation.
3. **Notify your care team** — Nurse Emily Rodriguez can be reached at (555) 204-1102.

⚠️ **If pain is sudden, severe, or accompanied by chest pain or shortness of breath, call emergency services immediately (911).**

Pain levels above 7/10 should always be reported to your nurse within 2 hours.`,

  appointment: `Your next upcoming appointment is:

**Physiotherapy Follow-up**
📅 June 10, 2026 at 10:00 AM
📍 Rapid Health Rehab Centre, Room 3A
👤 Mark Patel, Physiotherapist

*Tip: Wear comfortable, loose-fitting clothes and bring your walker.*

You also have a Nurse Check-in call on June 11 at 2:00 PM with Nurse Emily Rodriguez.`,

  medications: `Here are your medications for today:

| Medication | Dose | Time | Status |
|---|---|---|---|
| ✅ Acetaminophen | 500mg | 3×/day | Taken |
| ✅ Apixaban (Eliquis) | 2.5mg | Morning | Taken |
| ⏰ Celecoxib | 200mg | With lunch | Due |
| ⏰ Pantoprazole | 40mg | Before breakfast | Due |

**Important:** Do not skip Apixaban — it prevents dangerous blood clots after hip surgery.`,

  urgent: `The following symptoms require **immediate medical attention**:

🚨 **Call 911 or go to Emergency if you have:**
- Chest pain or tightness
- Sudden shortness of breath
- Signs of blood clot: severe calf pain, calf warmth/redness, leg swelling

⚠️ **Contact your care team within 1-2 hours if you have:**
- Fever above 38.5°C (101.3°F)
- Wound opening, unusual discharge, or increasing redness
- Pain level consistently above 7/10

📞 Nurse Emily Rodriguez: (555) 204-1102`,

  default: `I'm Rapid Recovery, your AI-powered recovery assistant for your Total Hip Replacement recovery.

I can help you with:
- 💊 Medication schedules and instructions
- 📅 Appointment reminders
- 🏃 Recovery exercises and restrictions
- ⚠️ When to contact your care team
- 🩺 Symptom guidance

**Try asking me:** "Can I climb stairs today?" or "What medications do I take today?"

*Remember: I provide recovery guidance based on your care plan, but I am not a substitute for professional medical advice.*`,
}

export function getAIResponse(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('stair') || lower.includes('climb') || lower.includes('step')) {
    return AI_RESPONSES.stairs
  }
  if (
    lower.includes('pain') &&
    (lower.includes('8') || lower.includes('9') || lower.includes('10') || lower.includes('severe'))
  ) {
    return AI_RESPONSES.pain
  }
  if (
    lower.includes('appointment') ||
    lower.includes('next') ||
    lower.includes('schedule') ||
    lower.includes('when')
  ) {
    return AI_RESPONSES.appointment
  }
  if (
    lower.includes('medication') ||
    lower.includes('medicine') ||
    lower.includes('drug') ||
    lower.includes('pill') ||
    lower.includes('take today')
  ) {
    return AI_RESPONSES.medications
  }
  if (
    lower.includes('urgent') ||
    lower.includes('emergency') ||
    lower.includes('warning') ||
    lower.includes('danger') ||
    lower.includes('symptom')
  ) {
    return AI_RESPONSES.urgent
  }
  return AI_RESPONSES.default
}
