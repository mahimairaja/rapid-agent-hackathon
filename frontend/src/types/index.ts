// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthToken {
  access_token: string
  token_type?: string
}

export interface UserMe {
  id: string
  email: string
  full_name?: string | null
  is_active: boolean
  is_superuser: boolean
  // Journey onboarding link: present once the account has claimed a profile.
  patient_code?: string | null
}

// ── Journey onboarding ────────────────────────────────────────────────────────

export interface Journey {
  journey_code: string
  title: string
  icon: string
  condition?: string | null
  clinician?: string | null
  sample_name: string
  medication_count: number
  appointment_kinds: string[]
}

export interface ClaimCounts {
  medications: number
  appointments: number
  care_plan_chunks: number
}

export interface ClaimResponse {
  patient_id: string
  patient_code: string
  first_name: string
  last_name: string
  journey_code: string
  counts: ClaimCounts
}

// ── Session booking (calendar widget) ────────────────────────────────────────

export interface SessionSlot {
  start_iso: string
  start_local: string
  time_zone?: string
}

export interface SessionBooking {
  kind?: string
  start_iso?: string
  start_local?: string
  end_iso?: string | null
  provider?: string | null
  location?: string | null
  status?: string
  cal_booking_uid?: string | null
}

export interface SessionSlotsResponse {
  status: string
  window?: { start_iso: string; end_iso: string } | null
  current_booking?: SessionBooking | null
  slots: SessionSlot[]
}

export interface SessionBookResponse {
  status: string
  booking?: SessionBooking | null
}

// ── Patient ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type RecoveryStage =
  | 'pre-discharge'
  | 'week-1'
  | 'week-2'
  | 'week-3'
  | 'week-4'
  | 'month-2'
  | 'month-3'

export interface CareTeamMember {
  id: string
  name: string
  role: string
  phone?: string
  email?: string
  avatar?: string
}

export interface Patient {
  id: string
  patient_id: string
  first_name: string
  last_name: string
  birth_date?: string
  gender?: string
  city?: string
  state?: string
  phone?: string
  email?: string
  discharge_reason?: string
  assigned_clinician?: string
  follow_up_required?: boolean
  follow_up_window_start?: string
  follow_up_window_end?: string
  follow_up_kind?: string
  // Extended fields for demo
  age?: number
  procedure?: string
  procedure_date?: string
  discharge_date?: string
  risk_level?: RiskLevel
  recovery_stage?: RecoveryStage
  care_team?: CareTeamMember[]
  allergies?: string[]
  conditions?: string[]
}

// ── Medication ────────────────────────────────────────────────────────────────

export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'as-needed'
  | 'bedtime'
  | 'with-meals'
  | (string & {})

export interface Medication {
  id: string
  patient_id: string
  name: string
  code?: string
  dosage?: string
  frequency?: MedicationFrequency
  purpose?: string
  instructions?: string
  schedule_times?: string[]
  cautions?: string[]
  start?: string
  stop?: string
  reason?: string
  taken_today?: boolean
}

// ── Appointment ───────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'upcoming' | (string & {})

export interface Appointment {
  id: string
  patient_id: string
  kind: string
  title?: string
  start: string
  end?: string
  provider?: string
  location?: string
  reason?: string
  status: AppointmentStatus
  instructions?: string
  cal_booking_uid?: string
  follow_up_window_start?: string
  follow_up_window_end?: string
  follow_up_required?: boolean
  booked_at?: string
}

export interface ProfessionalAppointment extends Appointment {
  patient_name: string
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface AgentChatRequest {
  message: string
  session_id?: string | null
  time_zone?: string | null
}

export interface AgentChatResponse {
  session_id: string
  reply: string
}

export interface AgentChatResult {
  sessionId: string | null
  reply: string
  demo: boolean
}

export interface PatientDashboardRequest {
  patient_code: string
  time_zone?: string | null
}

export interface PatientDashboardResponse {
  patient: Patient
  medications: Medication[]
  appointments: Appointment[]
}

export type MessageRole = 'user' | 'assistant'

// A grounding source emitted by the backend for one assistant turn. The
// frontend matches it against the grounding panel: medication by name,
// appointment by kind/start_iso, care_plan by (source_file, chunk_index).
export interface SourceItem {
  type: 'identity' | 'plan' | 'medication' | 'appointment' | 'care_plan' | 'symptom'
  tool?: string
  name?: string
  kind?: string
  start_iso?: string
  source_file?: string
  chunk_index?: number
  snippet?: string
  rule_id?: string
  status?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  typing?: boolean
  sources?: SourceItem[]
}

// ── Live-session grounding context (GET /agent/session/{id}/context) ───────────

export interface CarePlanChunkOut {
  text: string
  source_file: string
  chunk_index: number
}

export interface SessionContext {
  verified: boolean
  patient?: Patient | null
  medications?: Medication[]
  appointments?: Appointment[]
  care_plan?: { chunks: CarePlanChunkOut[]; summary?: string | null } | null
}

// ── Symptom Triage ────────────────────────────────────────────────────────────

export interface SymptomCheckIn {
  pain_level: number
  fever: boolean
  swelling: boolean
  shortness_of_breath: boolean
  wound_discharge: boolean
  calf_swelling: boolean
  notes: string
}

export type TriageLevel = 'urgent' | 'caution' | 'stable'

export interface TriageResult {
  level: TriageLevel
  title: string
  message: string
  actions: string[]
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type AppView =
  | 'dashboard'
  | 'medications'
  | 'appointments'
  | 'assistant'
  | 'symptom-check'
  | 'care-team'

export type ProfessionalAppView =
  | 'patient-queue'
  | 'patient-profile'
  | 'escalation-center'
  | 'appointments'

export interface PatientQueueItem {
  id: string
  patient_id: string
  first_name: string
  last_name: string
  risk_level: RiskLevel
  status?: 'active' | 'inactive'
  last_check_in?: string
  next_appointment?: string
  assigned_staff?: string
  escalation?: string
  escalation_level?: 'critical' | 'high' | 'medium'
}

export interface DemoMode {
  active: boolean
  reason?: string
}

export interface ProfessionalEscalation {
  id: string
  patient_id: string
  patient_name: string
  kind: string
  level: 'critical' | 'high' | 'medium' | 'low'
  message: string
  status: 'open' | 'resolved'
  created_at: string
}
