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

// Per-medication phrasing beats the shared clinical-reason phrasing: the three
// heart medications all carry "Chronic congestive heart failure" but do
// different jobs. Keys are lowercase substrings of the seeded med names.
const MED_NAME_REASONS: Array<[string, string]> = [
  ['furosemide', 'removes extra fluid so your heart works easier'],
  ['lisinopril', 'relaxes blood vessels and lowers blood pressure'],
  ['metoprolol', 'slows your heart rate so your heart can recover'],
  ['metformin', 'keeps your blood sugar in a healthy range'],
  ['oxycodone', 'manages pain while your knee heals'],
  ['acetaminophen', 'covers baseline pain between stronger doses'],
  ['aspirin', 'prevents blood clots while you heal'],
  ['prednisone', 'calms the airway inflammation from the flare-up'],
  ['albuterol', 'opens your airways quickly when breathing gets hard'],
  ['tiotropium', 'keeps your airways open day to day'],
]

export function friendlyReason(
  reason?: string | null,
  medicationName?: string | null,
): string | null {
  const name = medicationName?.toLowerCase() ?? ''
  for (const [key, text] of MED_NAME_REASONS) {
    if (name.includes(key)) return text
  }
  if (!reason) return null
  return REASON_FRIENDLY[reason] ?? reason
}
