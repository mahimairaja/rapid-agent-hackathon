import type { ClaimResponse } from '../types'

export interface BuildStage {
  icon: string
  label: string
}

/** Stage list driven by the real counts in a claim response. */
export function buildStagesFromClaim(claim: ClaimResponse): BuildStage[] {
  return [
    { icon: '👤', label: `Creating ${claim.first_name}'s profile` },
    { icon: '💊', label: `Copying ${claim.counts.medications} medications` },
    { icon: '📅', label: `Scheduling ${claim.counts.appointments} appointments` },
    {
      icon: '📚',
      label: `Ingesting your care plan — ${claim.counts.care_plan_chunks} knowledge chunk${
        claim.counts.care_plan_chunks === 1 ? '' : 's'
      } indexed`,
    },
    { icon: '✅', label: 'Your personal knowledge base is ready' },
  ]
}

/** Reveal stages one by one (450ms apart), then fire onDone. */
export function playStages(count: number, tick: (next: number) => void, onDone: () => void): void {
  for (let i = 0; i < count; i++) {
    setTimeout(() => tick(i + 1), 450 * (i + 1))
  }
  setTimeout(onDone, 450 * count + 500)
}
