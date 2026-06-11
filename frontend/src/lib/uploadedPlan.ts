import type { Patient } from '../types'

// Must match the discharge_reason written by the upload endpoint
// (backend/src/api/endpoints/onboarding.py::upload_discharge).
export const UPLOADED_PLAN_REASON = 'Personal recovery plan (uploaded)'

export function isUploadedPlan(patient?: Pick<Patient, 'discharge_reason'> | null): boolean {
  return patient?.discharge_reason === UPLOADED_PLAN_REASON
}
