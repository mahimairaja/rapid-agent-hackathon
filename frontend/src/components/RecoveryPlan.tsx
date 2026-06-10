import { useState } from 'react'
import { milestonesForCondition } from '../data/recoveryPlans'

interface RecoveryPlanProps {
  // The patient's discharge reason selects condition-specific milestones; the
  // demo-mode mock (hip replacement) is the fallback.
  condition?: string | null
}

export function RecoveryPlan({ condition }: RecoveryPlanProps) {
  const [expanded, setExpanded] = useState<string>('ms-1')
  const milestones = milestonesForCondition(condition)

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? '' : id))
  }

  return (
    <div role="list" aria-label="Recovery milestones">
      {milestones.map((milestone, idx) => {
        const isOpen = expanded === milestone.id
        const isCurrent = idx === 0

        return (
          <div
            key={milestone.id}
            className="recovery-milestone"
            role="listitem"
            style={{
              animationDelay: `${idx * 0.06}s`,
              animation: 'slide-up 0.35s var(--ease-out) both',
            }}
          >
            <div
              className={`recovery-milestone-header${isOpen ? ' active' : ''}`}
              onClick={() => toggle(milestone.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              aria-controls={`milestone-body-${milestone.id}`}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(milestone.id)}
            >
              <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
                <span className={`milestone-week-badge${isCurrent ? ' current' : ''}`}>
                  {milestone.week}
                </span>
                <span className="milestone-title">{milestone.title}</span>
                {isCurrent && (
                  <span className="badge badge-blue" style={{ fontSize: 9.5 }}>
                    Active
                  </span>
                )}
              </div>
              <span className={`milestone-chevron${isOpen ? ' open' : ''}`} aria-hidden="true">
                ▾
              </span>
            </div>

            {isOpen && (
              <div
                id={`milestone-body-${milestone.id}`}
                className="recovery-milestone-body"
                role="region"
                aria-label={`${milestone.week} details`}
              >
                <div>
                  <div className="milestone-section-label goals">✓ Goals this period</div>
                  <ul role="list">
                    {milestone.goals.map((goal, i) => (
                      <li key={i} className="milestone-list-item goals">
                        <span className="milestone-list-item-dot" aria-hidden="true" />
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="milestone-section-label restrictions">✗ Restrictions</div>
                  <ul role="list">
                    {milestone.restrictions.map((r, i) => (
                      <li key={i} className="milestone-list-item restrictions">
                        <span className="milestone-list-item-dot" aria-hidden="true" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
