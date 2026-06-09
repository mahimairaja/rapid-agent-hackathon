import type { PatientQueueItem, ProfessionalAppointment, ProfessionalEscalation } from '../types'

export const MOCK_PATIENT_QUEUE: PatientQueueItem[] = [
  {
    id: '1',
    patient_id: 'P-1001',
    first_name: 'John',
    last_name: 'Doe',
    risk_level: 'critical',
    status: 'active',
    last_check_in: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    next_appointment: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days from now
    assigned_staff: 'Dr. Smith',
    escalation: 'Severe chest pain reported during symptom check-in.',
    escalation_level: 'critical',
  },
  {
    id: '2',
    patient_id: 'P-1002',
    first_name: 'Sarah',
    last_name: 'Lee',
    risk_level: 'high',
    status: 'active',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    next_appointment: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    assigned_staff: 'Nurse Davis',
    escalation: 'Shortness of breath. Oxygen levels dropping.',
    escalation_level: 'high',
  },
  {
    id: '3',
    patient_id: 'P-1003',
    first_name: 'Mark',
    last_name: 'Kim',
    risk_level: 'moderate',
    status: 'active',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    next_appointment: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(), // tomorrow
    assigned_staff: 'Dr. Smith',
    escalation: 'Increased swelling in lower extremities.',
    escalation_level: 'medium',
  },
  {
    id: '4',
    patient_id: 'P-1004',
    first_name: 'Emma',
    last_name: 'Watson',
    risk_level: 'low',
    status: 'active',
    last_check_in: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    next_appointment: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    assigned_staff: 'Dr. Johnson',
  },
  {
    id: '5',
    patient_id: 'P-1005',
    first_name: 'James',
    last_name: 'Brown',
    risk_level: 'moderate',
    status: 'active',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    next_appointment: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    assigned_staff: 'Nurse Davis',
  },
]

export const MOCK_PATIENT_DIRECTORY: PatientQueueItem[] = [
  ...MOCK_PATIENT_QUEUE,
  {
    id: '6',
    patient_id: 'P-1006',
    first_name: 'Alice',
    last_name: 'Cooper',
    risk_level: 'low',
    status: 'inactive',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    assigned_staff: 'Dr. Smith',
  },
  {
    id: '7',
    patient_id: 'P-1007',
    first_name: 'Robert',
    last_name: 'Gomez',
    risk_level: 'low',
    status: 'inactive',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    assigned_staff: 'Nurse Davis',
  },
  {
    id: '8',
    patient_id: 'P-1008',
    first_name: 'Linda',
    last_name: 'Chen',
    risk_level: 'moderate',
    status: 'inactive',
    last_check_in: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    assigned_staff: 'Dr. Johnson',
  }
]

export const MOCK_PROFESSIONAL_APPOINTMENTS: ProfessionalAppointment[] = [
  {
    id: 'A-101',
    patient_id: 'P-1001',
    patient_name: 'John Doe',
    kind: 'Post-op Follow-up',
    title: 'Post-op Follow-up - John Doe',
    start: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
    provider: 'Dr. Smith',
    location: 'Clinic Room A',
    reason: 'Routine check of surgical incision site and pain management review.',
    status: 'scheduled',
  },
  {
    id: 'A-102',
    patient_id: 'P-1002',
    patient_name: 'Sarah Lee',
    kind: 'Wound Assessment',
    title: 'Wound Assessment - Sarah Lee',
    start: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 hours from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 4.5).toISOString(),
    provider: 'Nurse Davis',
    location: 'Wound Care Suite',
    reason: 'Checking post-discharge dressing and cleaning wound.',
    status: 'scheduled',
  },
  {
    id: 'A-103',
    patient_id: 'P-1003',
    patient_name: 'Mark Kim',
    kind: 'Cardiology Consultation',
    title: 'Cardiology Consultation - Mark Kim',
    start: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(), // 6 hours from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 7).toISOString(),
    provider: 'Dr. Smith',
    location: 'Cardiology Clinic',
    reason: 'ECG review and adjustment of blood pressure medications.',
    status: 'scheduled',
  },
  {
    id: 'A-104',
    patient_id: 'P-1004',
    patient_name: 'Emma Watson',
    kind: 'Routine Check-up',
    title: 'Routine Check-up - Emma Watson',
    start: new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(), // Tomorrow (~25 hours from now)
    end: new Date(Date.now() + 1000 * 60 * 60 * 25.5).toISOString(),
    provider: 'Dr. Johnson',
    location: 'Clinic Room B',
    reason: 'General wellness check and review of symptoms diary.',
    status: 'scheduled',
  },
  {
    id: 'A-105',
    patient_id: 'P-1005',
    patient_name: 'James Brown',
    kind: 'Physiotherapy Review',
    title: 'Physiotherapy Review - James Brown',
    start: new Date(Date.now() + 1000 * 60 * 60 * 28).toISOString(), // Tomorrow (~28 hours from now)
    end: new Date(Date.now() + 1000 * 60 * 60 * 29).toISOString(),
    provider: 'Nurse Davis',
    location: 'Rehab Gym',
    reason: 'Mobility and strength assessments after discharge.',
    status: 'scheduled',
  },
  {
    id: 'A-106',
    patient_id: 'P-1006',
    patient_name: 'Alice Cooper',
    kind: 'General Check-up',
    title: 'General Check-up - Alice Cooper',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5 + 1000 * 60 * 30).toISOString(),
    provider: 'Dr. Smith',
    location: 'Clinic Room A',
    reason: 'Scheduled standard checkup.',
    status: 'scheduled',
  },
  {
    id: 'A-107',
    patient_id: 'P-1007',
    patient_name: 'Robert Gomez',
    kind: 'Follow-up',
    title: 'Follow-up - Robert Gomez',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(), // 6 days from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6 + 1000 * 60 * 30).toISOString(),
    provider: 'Nurse Davis',
    location: 'Clinic Room C',
    reason: 'Routine monitoring after discharge.',
    status: 'scheduled',
  }
]

export const MOCK_PROFESSIONAL_ESCALATIONS: ProfessionalEscalation[] = [
  {
    id: 'E-001',
    patient_id: 'P-1001',
    patient_name: 'John Doe',
    kind: 'symptom_triage',
    level: 'critical',
    message: 'Severe chest pain reported during symptom check-in. Immediate clinical call recommended.',
    status: 'open',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
  },
  {
    id: 'E-002',
    patient_id: 'P-1002',
    patient_name: 'Sarah Lee',
    kind: 'symptom_triage',
    level: 'high',
    message: 'Shortness of breath reported. Oxygen levels dropped to 92% in self-reported vitals.',
    status: 'open',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2h ago
  },
  {
    id: 'E-003',
    patient_id: 'P-1003',
    patient_name: 'Mark Kim',
    kind: 'pharmacist_question',
    level: 'medium',
    message: 'Potential mild drug interaction flagged: Patient reports self-administering over-the-counter NSAIDs along with prescribed anticoagulants.',
    status: 'open',
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4h ago
  },
  {
    id: 'E-004',
    patient_id: 'P-1005',
    patient_name: 'James Brown',
    kind: 'symptom_triage',
    level: 'low',
    message: 'Mild ankle stiffness reported during morning check-in. Normal recovery stage behavior.',
    status: 'resolved',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  }
]


