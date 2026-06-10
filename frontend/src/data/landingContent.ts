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
    title: 'Personalized Plan Recognition',
    text: 'Our AI instantly maps your specific discharge instructions, medications, and limits.',
    widget: {
      title: 'Discharge Plan',
      val: '100',
      valSuffix: '%',
      lbl: 'Mapped accurately',
      status: 'Active',
      icon: 'clipboard',
    },
  },
  {
    step: '2',
    title: 'Grounded Recovery Answers',
    text: 'Ask anything about your recovery. Every answer is sourced strictly from your care plan.',
    widget: {
      title: 'AI Assistant',
      val: '24/7',
      valSuffix: '',
      lbl: 'Availability',
      status: 'Always on',
      icon: 'message',
    },
  },
  {
    step: '3',
    title: 'Medication Schedule and Safe Use',
    text: 'Get timely reminders and safe dosage instructions to prevent errors and ensure compliance.',
    widget: {
      title: 'Medications',
      val: '100',
      valSuffix: '%',
      lbl: 'Adherence',
      status: 'On track',
      icon: 'activity',
    },
  },
  {
    step: '4',
    title: 'Follow-up Appointment Scheduling',
    text: 'Easily view and manage your upcoming doctor and physical therapy appointments.',
    widget: {
      title: 'Appointments',
      val: '3',
      valSuffix: '',
      lbl: 'Upcoming',
      status: 'Scheduled',
      icon: 'calendar',
    },
  },
  {
    step: '5',
    title: 'Symptom Check-in and Red-flag Escalation',
    text: 'Log daily symptoms and automatically alert your care team if critical red-flags appear.',
    widget: {
      title: 'Care Team Alerts',
      val: '0',
      valSuffix: '',
      lbl: 'Red flags today',
      status: 'All clear',
      icon: 'shield',
    },
  },
  {
    step: '6',
    title: 'Natural Spoken Conversation',
    text: 'Interact with your assistant using natural voice commands, just like a phone call.',
    widget: {
      title: 'Voice Chat',
      val: 'Voice',
      valSuffix: '',
      lbl: 'Enabled',
      status: 'Listening',
      icon: 'mic',
    },
  },
  {
    step: '7',
    title: 'Care Team Oversight View',
    text: 'Providers get a comprehensive dashboard to monitor your progress and intervene when necessary.',
    widget: {
      title: 'Provider View',
      val: 'Live',
      valSuffix: '',
      lbl: 'Sync status',
      status: 'Connected',
      icon: 'eye',
    },
  },
]

export const ONBOARDING_PROCESS = [
  {
    step: '01',
    title: 'Choose your journey',
    text: 'Pick a sample recovery plan like Knee Replacement or Heart Failure from our gallery.',
    icon: 'layout',
  },
  {
    step: '02',
    title: 'Personalize your profile',
    text: 'Enter your name and details to tailor the experience precisely to your needs.',
    icon: 'user',
  },
  {
    step: '03',
    title: 'Build your knowledge base',
    text: 'Our AI instantly maps your specific medications, instructions, and follow-ups.',
    icon: 'database',
  },
  {
    step: '04',
    title: 'Start recovering',
    text: 'Chat with your assistant, log your daily symptoms, and stay on track seamlessly.',
    icon: 'check',
  },
]
