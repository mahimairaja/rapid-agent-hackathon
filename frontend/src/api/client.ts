import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentChatResult,
  AuthToken,
  PatientDashboardRequest,
  PatientDashboardResponse,
  UserMe,
  Patient,
  Medication,
  Appointment,
} from '../types'
import { MOCK_PATIENT, MOCK_MEDICATIONS, MOCK_APPOINTMENTS } from '../data/mockData'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

// ── HTTP helper ───────────────────────────────────────────────────────────────

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
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
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

export function getStoredPatientCode(): string | null {
  return localStorage.getItem(PATIENT_CODE_KEY)
}

export function setStoredPatientCode(patientCode: string): void {
  localStorage.setItem(PATIENT_CODE_KEY, patientCode)
}

export function clearStoredPatientCode(): void {
  localStorage.removeItem(PATIENT_CODE_KEY)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string, name: string): Promise<AuthToken> {
  return request<AuthToken>('/users/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
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

export async function postAgentChat(
  payload: AgentChatRequest,
  token: string | null,
): Promise<AgentChatResult> {
  try {
    const data = await request<AgentChatResponse>(
      '/agent/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    )
    return { sessionId: data.session_id, reply: data.reply, demo: false }
  } catch {
    return { sessionId: payload.session_id ?? null, reply: '', demo: true }
  }
}
