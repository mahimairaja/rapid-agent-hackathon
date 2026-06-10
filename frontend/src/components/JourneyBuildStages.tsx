import type { BuildStage } from '../lib/journeyBuild'

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
          <span className="journey-build-icon">{i < stageIndex ? stage.icon : '○'}</span>
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  )
}
