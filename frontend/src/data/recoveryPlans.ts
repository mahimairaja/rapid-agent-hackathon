import type { RecoveryMilestone } from './mockData'

/**
 * Condition-specific recovery milestones for the dashboard plan card, keyed by
 * keywords in the patient's discharge reason. The journey clone carries the
 * sample's discharge_reason, so an onboarded heart-failure patient sees heart
 * failure milestones — not the demo's hip-replacement content. Synthetic demo
 * content, consistent with the seeded care plans.
 */

const HEART_FAILURE: RecoveryMilestone[] = [
  {
    id: 'ms-1',
    week: 'Week 1',
    title: 'Stabilize & Daily Monitoring',
    goals: [
      'Weigh yourself every morning and write it down',
      'Take Furosemide, Lisinopril, and Metoprolol every day',
      'Limit salt (under 2 g) and fluids (about 2 L) daily',
      'Rest with legs elevated when sitting',
    ],
    restrictions: [
      'Call the team for 2–3 lb weight gain in a day',
      'No skipping the diuretic, even on good days',
      'Avoid added-salt and processed foods',
    ],
    completed: false,
  },
  {
    id: 'ms-2',
    week: 'Week 2–3',
    title: 'Gentle Activity',
    goals: [
      'Short daily walks at a comfortable pace',
      'Keep the daily weight log going',
      'Attend the lab draw and cardiology follow-up',
    ],
    restrictions: ['Stop and rest if short of breath', 'No heavy lifting or straining'],
    completed: false,
  },
  {
    id: 'ms-3',
    week: 'Week 4–6',
    title: 'Building Endurance',
    goals: [
      'Gradually longer walks as tolerated',
      'Review medications with cardiology',
      'Discuss cardiac rehab enrollment',
    ],
    restrictions: ['Keep monitoring weight daily', 'Escalate any sleep breathlessness'],
    completed: false,
  },
]

const KNEE_REPLACEMENT: RecoveryMilestone[] = [
  {
    id: 'ms-1',
    week: 'Week 1',
    title: 'Early Recovery & Wound Care',
    goals: [
      'Short assisted walks (10–15 min, 3×/day)',
      'Ankle pumps and quad sets every hour awake',
      'Ice the knee 20 min on/off for swelling',
      'Keep the incision clean and dry',
    ],
    restrictions: [
      'No kneeling or pivoting on the new knee',
      'No driving while on opioid pain medication',
      'Use the walker for all walking',
    ],
    completed: false,
  },
  {
    id: 'ms-2',
    week: 'Week 2–3',
    title: 'Increasing Mobility',
    goals: [
      'Progress from walker to cane with PT',
      'Work toward 90° knee bend',
      'Start outpatient physical therapy',
    ],
    restrictions: ['No high-impact activity', 'Avoid low chairs and deep squats'],
    completed: false,
  },
  {
    id: 'ms-3',
    week: 'Week 4–6',
    title: 'Active Rehabilitation',
    goals: [
      'Independent walking short distances',
      'Stationary bike as cleared by PT',
      'Return to light daily activities',
    ],
    restrictions: ['No running or jumping yet', 'Clear driving with the surgeon first'],
    completed: false,
  },
]

const DIABETES: RecoveryMilestone[] = [
  {
    id: 'ms-1',
    week: 'Week 1',
    title: 'Learning the Routine',
    goals: [
      'Check fasting glucose each morning and log it',
      'Take Metformin with food as prescribed',
      'Build plates around vegetables and lean protein',
      'Walk 15–20 minutes after one meal a day',
    ],
    restrictions: [
      'Avoid sugary drinks and juices',
      'Call the team for readings over 300 mg/dL',
      'Know the signs of low blood sugar',
    ],
    completed: false,
  },
  {
    id: 'ms-2',
    week: 'Week 2–3',
    title: 'Settling In',
    goals: [
      'Attend diabetes education session',
      'Keep the glucose log going to spot patterns',
      'Increase walks toward 30 minutes most days',
    ],
    restrictions: ['Do not skip Metformin doses', 'Limit refined carbohydrates'],
    completed: false,
  },
  {
    id: 'ms-3',
    week: 'Week 4–6',
    title: 'Confident Self-Management',
    goals: [
      'Review the log at the endocrinology follow-up',
      'Discuss A1c targets with the care team',
      'Maintain regular meal and activity rhythm',
    ],
    restrictions: ['Keep checking glucose as advised', 'Report frequent lows promptly'],
    completed: false,
  },
]

const COPD: RecoveryMilestone[] = [
  {
    id: 'ms-1',
    week: 'Week 1',
    title: 'Breathing & Medication Routine',
    goals: [
      'Use the controller inhaler morning and night',
      'Practice pursed-lip breathing twice daily',
      'Keep the rescue inhaler within reach',
      'Note your baseline breathlessness each day',
    ],
    restrictions: [
      'Absolutely no smoking or smoke exposure',
      'Avoid cold air and strong fumes',
      'Call the team if the rescue inhaler is needed often',
    ],
    completed: false,
  },
  {
    id: 'ms-2',
    week: 'Week 2–3',
    title: 'Gentle Conditioning',
    goals: [
      'Short paced walks with rest breaks',
      'Continue breathing exercises daily',
      'Attend the pulmonology follow-up',
    ],
    restrictions: ['Pace activities; stop before exhaustion', 'Avoid respiratory infections'],
    completed: false,
  },
  {
    id: 'ms-3',
    week: 'Week 4–6',
    title: 'Endurance & Prevention',
    goals: [
      'Gradually longer walks as breathing allows',
      'Discuss pulmonary rehab enrollment',
      'Stay current on flu and pneumonia vaccines',
    ],
    restrictions: ['Keep rescue inhaler use logged', 'Escalate any fever with sputum change'],
    completed: false,
  },
]

interface ConditionContent {
  match: RegExp
  milestones: RecoveryMilestone[]
  dailyAction: string
}

// Order matters only for overlapping wording; discharge reasons in the seeds
// match exactly one entry. Unmatched reasons (uploaded plans) get no canned
// content at all; callers render a document-sourced fallback instead.
const CONDITION_CONTENT: ConditionContent[] = [
  {
    match: /heart failure|cardiac|chf/i,
    milestones: HEART_FAILURE,
    dailyAction: 'Weigh yourself each morning and log it',
  },
  {
    match: /knee/i,
    milestones: KNEE_REPLACEMENT,
    dailyAction: 'Continue assisted walks 3× daily',
  },
  {
    match: /diabet/i,
    milestones: DIABETES,
    dailyAction: 'Check fasting glucose before breakfast',
  },
  {
    match: /copd|pulmonary|respiratory/i,
    milestones: COPD,
    dailyAction: 'Use your controller inhaler morning and night',
  },
]

function contentFor(dischargeReason?: string | null): ConditionContent | null {
  if (!dischargeReason) return null
  return CONDITION_CONTENT.find((c) => c.match.test(dischargeReason)) ?? null
}

export function milestonesForCondition(
  dischargeReason?: string | null,
): RecoveryMilestone[] | null {
  // No match (uploaded plans, unknown conditions): never show another
  // condition's milestones. The demo provider view imports the hip mock
  // directly from mockData and is unaffected.
  return contentFor(dischargeReason)?.milestones ?? null
}

export function dailyActionForCondition(dischargeReason?: string | null): string {
  return contentFor(dischargeReason)?.dailyAction ?? 'Check in with Maya about today’s plan'
}
