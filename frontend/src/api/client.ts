import type { AuthToken, UserMe, Patient, Medication, Appointment } from '../types'
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

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
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

// ── Patient data (with mock fallbacks) ───────────────────────────────────────

export async function fetchPatients(
  token: string | null,
): Promise<{ data: Patient[]; demo: boolean }> {
  try {
    const data = await request<Patient[]>('/patients', {}, token)
    return { data, demo: false }
  } catch {
    return { data: [MOCK_PATIENT], demo: true }
  }
}

export async function fetchPatient(
  id: string,
  token: string | null,
): Promise<{ data: Patient; demo: boolean }> {
  try {
    const data = await request<Patient>(`/patients/${id}`, {}, token)
    return { data, demo: false }
  } catch {
    return { data: MOCK_PATIENT, demo: true }
  }
}

export async function fetchMedications(
  patientId: string,
  token: string | null,
): Promise<{ data: Medication[]; demo: boolean }> {
  try {
    const data = await request<Medication[]>(`/medications?patient_id=${patientId}`, {}, token)
    return { data, demo: false }
  } catch {
    return { data: MOCK_MEDICATIONS, demo: true }
  }
}

export async function fetchAppointments(
  patientId: string,
  token: string | null,
): Promise<{ data: Appointment[]; demo: boolean }> {
  try {
    const data = await request<Appointment[]>(`/appointments?patient_id=${patientId}`, {}, token)
    return { data, demo: false }
  } catch {
    return { data: MOCK_APPOINTMENTS, demo: true }
  }
}

export async function postChatMessage(
  message: string,
  patientId: string,
  token: string | null,
): Promise<{ answer: string; demo: boolean }> {
  try {
    const data = await request<{ answer: string }>(
      '/rag/query',
      {
        method: 'POST',
        body: JSON.stringify({ query: message, patient_id: patientId }),
      },
      token,
    )
    return { answer: data.answer, demo: false }
  } catch {
    // Simulated AI handled in component via getAIResponse
    return { answer: '', demo: true }
  }
}
