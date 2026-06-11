import type { ClaimResponse } from '../types'

export interface BuildStage {
  // Icon key resolved to a lucide icon by JourneyBuildStages.
  icon: 'profile' | 'meds' | 'appts' | 'kb' | 'ready'
  label: string
}

/** Stage list driven by the real counts in a claim response. */
export function buildStagesFromClaim(claim: ClaimResponse): BuildStage[] {
  const stages: BuildStage[] = [
    { icon: 'profile', label: `Creating ${claim.first_name}'s profile` },
    { icon: 'meds', label: `Copying ${claim.counts.medications} medications` },
    { icon: 'appts', label: `Scheduling ${claim.counts.appointments} appointments` },
    {
      icon: 'kb',
      label: `Ingesting your care plan: ${claim.counts.care_plan_chunks} knowledge chunk${
        claim.counts.care_plan_chunks === 1 ? '' : 's'
      } indexed`,
    },
    { icon: 'ready', label: 'Your personal knowledge base is ready' },
  ]
  // Uploaded plans carry no medications/appointments yet; skip empty stages.
  return stages.filter((s) => !/Copying 0 |Scheduling 0 /.test(s.label))
}

/** Reveal stages one by one (450ms apart), then fire onDone. */
export function playStages(count: number, tick: (next: number) => void, onDone: () => void): void {
  for (let i = 0; i < count; i++) {
    setTimeout(() => tick(i + 1), 450 * (i + 1))
  }
  setTimeout(onDone, 450 * count + 500)
}
