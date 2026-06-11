// Patient-friendly phrasing for the clinical medication reasons in the seeded
// journeys (backend/data/synthea/medications.csv). Unmapped reasons fall back
// to the raw clinical text.
export const REASON_FRIENDLY: Record<string, string> = {
  'Chronic congestive heart failure': 'supports your heart and prevents fluid buildup',
  'Postoperative pain - total knee replacement': 'manages pain while your knee heals',
  'Venous thromboembolism prophylaxis': 'prevents blood clots while you heal',
  'Type 2 diabetes mellitus': 'keeps your blood sugar in a healthy range',
  'COPD exacerbation': 'opens your airways and calms the flare-up',
  'Chronic obstructive pulmonary disease': 'keeps your airways open day to day',
}

export function friendlyReason(reason?: string | null): string | null {
  if (!reason) return null
  return REASON_FRIENDLY[reason] ?? reason
}
