import type { ReactNode } from 'react'
import { BookOpenText, CalendarDays, CheckCircle2, Circle, Pill, UserRound } from 'lucide-react'
import type { BuildStage } from '../lib/journeyBuild'

const STAGE_ICONS: Record<BuildStage['icon'], ReactNode> = {
  profile: <UserRound size={16} />,
  meds: <Pill size={16} />,
  appts: <CalendarDays size={16} />,
  kb: <BookOpenText size={16} />,
  ready: <CheckCircle2 size={16} />,
}

export function JourneyBuildStages({
  stages,
  stageIndex,
}: {
  stages: BuildStage[]
  stageIndex: number
}) {
  return (
    <div className="journey-build card">
      <div className="journey-build-title">Building your knowledge base</div>
      {stages.map((stage, i) => (
        <div key={stage.label} className={`journey-build-stage${i < stageIndex ? ' done' : ''}`}>
          <span className="journey-build-icon">
            {i < stageIndex ? STAGE_ICONS[stage.icon] : <Circle size={14} />}
          </span>
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  )
}
