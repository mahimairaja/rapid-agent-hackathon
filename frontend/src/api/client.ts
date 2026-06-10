import type {
  AuthToken,
  ClaimResponse,
  Journey,
  PatientDashboardRequest,
  PatientDashboardResponse,
  SessionBookResponse,
  SessionContext,
  SessionSlotsResponse,
  UserMe,
  Patient,
  Medication,
  Appointment,
  PatientQueueItem,
  ProfessionalAppointment,
  ProfessionalEscalation,
} from '../types'
import { MOCK_PATIENT, MOCK_MEDICATIONS, MOCK_APPOINTMENTS } from '../data/mockData'
import {
  MOCK_PATIENT_QUEUE,
  MOCK_PATIENT_DIRECTORY,
  MOCK_PROFESSIONAL_APPOINTMENTS,
  MOCK_PROFESSIONAL_ESCALATIONS,
} from '../data/mockProfessionalData'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

// ── HTTP helper ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    // FastAPI HTTPException uses `detail`; the app's error middleware uses
    // `error` (human-readable) and `message` (category).
    const err = (await res.json().catch(() => ({}))) as {
      detail?: unknown
      error?: unknown
      message?: unknown
    }
    const msg = [err.detail, err.error, err.message].find((v): v is string => typeof v === 'string')
    throw new ApiError(msg ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'rapid_agent_token'
const PATIENT_CODE_KEY = 'rapid_agent_patient_code'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// The patient-code gate is gone (identification is conversational); the key is
// only cleared so a pre-migration build's stored code does not linger.
export function clearStoredPatientCode(): void {
  localStorage.removeItem(PATIENT_CODE_KEY)
}

const ROLE_KEY = 'rapid_agent_role'

export function getStoredRole(): 'patient' | 'professional' | null {
  return localStorage.getItem(ROLE_KEY) as 'patient' | 'professional' | null
}

export function setStoredRole(role: 'patient' | 'professional'): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearStoredRole(): void {
  localStorage.removeItem(ROLE_KEY)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string, name: string): Promise<AuthToken> {
  // The API field is full_name; sending it under any other key silently drops
  // the name, and the journey gallery pre-fills from it.
  return request<AuthToken>('/users/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: name }),
  })
}

export async function login(email: string, password: string): Promise<AuthToken> {
  return request<AuthToken>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getMe(token: string): Promise<UserMe> {
  return request<UserMe>('/users/me', {}, token)
}

// ── Dashboard demo data ──────────────────────────────────────────────────────

interface DashboardData {
  patient: Patient
  medications: Medication[]
  appointments: Appointment[]
  demo: boolean
}

export async function loadDashboardData(): Promise<DashboardData> {
  return {
    patient: MOCK_PATIENT,
    medications: [...MOCK_MEDICATIONS],
    appointments: [...MOCK_APPOINTMENTS],
    demo: true,
  }
}

export async function fetchPatientDashboard(
  payload: PatientDashboardRequest,
  token: string,
): Promise<DashboardData> {
  const data = await request<PatientDashboardResponse>(
    '/patients/dashboard',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
  return { ...data, demo: false }
}

export async function fetchPatientQueue(): Promise<PatientQueueItem[]> {
  try {
    return await request<PatientQueueItem[]>('/professional/queue', {
      method: 'GET',
    })
  } catch (error) {
    console.warn('Backend /professional/queue endpoint failed. Falling back to mock data.', error)
    return new Promise((resolve) => setTimeout(() => resolve(MOCK_PATIENT_QUEUE), 800))
  }
}

export async function fetchPatientDirectory(): Promise<PatientQueueItem[]> {
  try {
    return await request<PatientQueueItem[]>('/professional/patients', {
      method: 'GET',
    })
  } catch (error) {
    console.warn(
      'Backend /professional/patients endpoint failed. Falling back to mock data.',
      error,
    )
    return new Promise((resolve) => setTimeout(() => resolve(MOCK_PATIENT_DIRECTORY), 800))
  }
}

export async function fetchProfessionalAppointments(): Promise<ProfessionalAppointment[]> {
  try {
    return await request<ProfessionalAppointment[]>('/professional/appointments', {
      method: 'GET',
    })
  } catch (error) {
    console.warn(
      'Backend /professional/appointments endpoint failed. Falling back to mock data.',
      error,
    )
    return new Promise((resolve) => setTimeout(() => resolve(MOCK_PROFESSIONAL_APPOINTMENTS), 800))
  }
}

export function getVoiceWsUrl(): string {
  // Reuse the REST base URL, swapping the scheme to ws/wss.
  const base = BASE_URL.replace(/^http/i, 'ws')
  return `${base}/voice/ws`
}

export function getClientTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

// ── Journey onboarding ────────────────────────────────────────────────────────

export async function getJourneys(): Promise<Journey[]> {
  return request<Journey[]>('/onboarding/journeys')
}

export async function claimJourney(
  payload: { journey_code: string; display_name: string; birth_year?: number | null },
  token: string,
): Promise<ClaimResponse> {
  return request<ClaimResponse>(
    '/onboarding/claim',
    { method: 'POST', body: JSON.stringify(payload) },
    token,
  )
}

// ── Session booking (calendar widget) ────────────────────────────────────────

export async function getSessionSlots(
  sessionId: string,
  timeZone: string | null,
): Promise<SessionSlotsResponse> {
  const qs = timeZone ? `?time_zone=${encodeURIComponent(timeZone)}` : ''
  try {
    return await request<SessionSlotsResponse>(
      `/agent/session/${encodeURIComponent(sessionId)}/slots${qs}`,
    )
  } catch {
    return { status: 'scheduler_unavailable', slots: [] }
  }
}

export async function postSessionBook(
  sessionId: string,
  payload: { start_iso: string; time_zone?: string | null },
): Promise<SessionBookResponse> {
  try {
    return await request<SessionBookResponse>(
      `/agent/session/${encodeURIComponent(sessionId)}/book`,
      { method: 'POST', body: JSON.stringify(payload) },
    )
  } catch {
    return { status: 'scheduler_unavailable' }
  }
}

/**
 * Load the grounding context for a live session (verified patient's plan, meds,
 * appointments, and care-plan chunks). Returns `{ verified: false }` on any
 * failure so the panel falls back to its placeholder.
 */
export async function getSessionContext(sessionId: string): Promise<SessionContext> {
  try {
    return await request<SessionContext>(`/agent/session/${encodeURIComponent(sessionId)}/context`)
  } catch {
    return { verified: false }
  }
}

export async function fetchProfessionalEscalations(): Promise<ProfessionalEscalation[]> {
  try {
    return await request<ProfessionalEscalation[]>('/professional/escalations', {
      method: 'GET',
    })
  } catch (error) {
    console.warn(
      'Backend /professional/escalations endpoint failed. Falling back to mock data.',
      error,
    )
    return new Promise((resolve) =>
      setTimeout(() => resolve([...MOCK_PROFESSIONAL_ESCALATIONS]), 800),
    )
  }
}

export async function resolveProfessionalEscalation(id: string): Promise<{ success: boolean }> {
  try {
    return await request<{ success: boolean }>(`/professional/escalations/${id}/resolve`, {
      method: 'POST',
    })
  } catch (error) {
    console.warn(
      `Backend /professional/escalations/${id}/resolve endpoint failed. Simulating local resolution.`,
      error,
    )
    // Simulate updating mock data state locally
    const index = MOCK_PROFESSIONAL_ESCALATIONS.findIndex((e) => e.id === id)
    if (index !== -1) {
      MOCK_PROFESSIONAL_ESCALATIONS[index].status = 'resolved'
    }
    return new Promise((resolve) => setTimeout(() => resolve({ success: true }), 500))
  }
}
