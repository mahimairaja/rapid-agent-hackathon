// Static content for the pre-auth landing page. Codes/titles mirror the
// seeded sample journeys; the wizard itself uses live GET /onboarding/journeys.
export interface LandingJourney {
  journey_code: string
  title: string
  blurb: string
  emoji: string
  image: string
}

export const LANDING_JOURNEYS: LandingJourney[] = [
  {
    journey_code: 'HW-1001',
    title: 'Heart failure recovery',
    blurb: 'Daily weights, fluid limits, and meds, explained in plain language.',
    emoji: '🫀',
    image: '/img/journey-heart.jpg',
  },
  {
    journey_code: 'HW-1002',
    title: 'Knee replacement recovery',
    blurb: 'Physio milestones, pain control, and the red flags to watch.',
    emoji: '🦵',
    image: '/img/journey-knee.jpg',
  },
  {
    journey_code: 'HW-1003',
    title: 'Type 2 diabetes onboarding',
    blurb: 'Glucose checks, insulin timing, and what to do when readings drift.',
    emoji: '🩸',
    image: '/img/journey-diabetes.jpg',
  },
  {
    journey_code: 'HW-1004',
    title: 'COPD recovery',
    blurb: 'Breathing techniques, inhaler routines, and flare-up plans.',
    emoji: '🫁',
    image: '/img/journey-copd.jpg',
  },
]

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Pick your recovery journey',
    text: 'Start from a realistic discharge plan: heart, knee, diabetes, or COPD.',
  },
  {
    step: '2',
    title: 'Meet your care assistant',
    text: 'Talk or type. Every answer is grounded in your own care plan.',
  },
  {
    step: '3',
    title: 'Stay on track',
    text: 'Symptom check-ins, medication reminders, and follow-up booking.',
  },
]
