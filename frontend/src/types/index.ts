// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type?: string;
}

export interface UserMe {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
}

// ── Patient ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type RecoveryStage = 'pre-discharge' | 'week-1' | 'week-2' | 'week-3' | 'week-4' | 'month-2' | 'month-3';

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  avatar?: string;
}

export interface Patient {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  gender?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  // Extended fields for demo
  age?: number;
  procedure?: string;
  procedure_date?: string;
  discharge_date?: string;
  risk_level?: RiskLevel;
  recovery_stage?: RecoveryStage;
  care_team?: CareTeamMember[];
  allergies?: string[];
  conditions?: string[];
}

// ── Medication ────────────────────────────────────────────────────────────────

export type MedicationFrequency = 'once-daily' | 'twice-daily' | 'three-times-daily' | 'as-needed' | 'bedtime' | 'with-meals';

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  code?: string;
  dosage?: string;
  frequency?: MedicationFrequency;
  purpose?: string;
  instructions?: string;
  start?: string;
  stop?: string;
  reason?: string;
  taken_today?: boolean;
}

// ── Appointment ───────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'upcoming';

export interface Appointment {
  id: string;
  patient_id: string;
  kind: string;
  title?: string;
  start: string;
  end?: string;
  provider?: string;
  location?: string;
  reason?: string;
  status: AppointmentStatus;
  instructions?: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  typing?: boolean;
}

// ── Symptom Triage ────────────────────────────────────────────────────────────

export interface SymptomCheckIn {
  pain_level: number;
  fever: boolean;
  swelling: boolean;
  shortness_of_breath: boolean;
  wound_discharge: boolean;
  calf_swelling: boolean;
  notes: string;
}

export type TriageLevel = 'urgent' | 'caution' | 'stable';

export interface TriageResult {
  level: TriageLevel;
  title: string;
  message: string;
  actions: string[];
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type AppView = 'dashboard' | 'medications' | 'appointments' | 'assistant' | 'symptom-check' | 'care-team';

export interface DemoMode {
  active: boolean;
  reason?: string;
}
