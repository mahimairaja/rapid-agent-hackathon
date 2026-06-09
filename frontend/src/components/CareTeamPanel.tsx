import type { CareTeamMember } from '../types'
import { URGENT_WARNING_SIGNS } from '../data/mockData'

interface CareTeamPanelProps {
  careTeam: CareTeamMember[]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const ROLE_ICONS: Record<string, string> = {
  'Orthopedic Surgeon': '🩺',
  'Recovery Nurse': '👩‍⚕️',
  Physiotherapist: '🏃',
  General: '⚕️',
}

export function CareTeamPanel({ careTeam }: CareTeamPanelProps) {
  return (
    <div>
      {/* Care team cards */}
      <div className="care-team-grid" style={{ marginBottom: 24 }}>
        {careTeam.map((member) => {
          const icon = ROLE_ICONS[member.role] ?? '⚕️'
          return (
            <div key={member.id} className="care-team-member-card">
              <div className="care-team-avatar">{getInitials(member.name)}</div>
              <div className="care-team-name">
                {icon} {member.name}
              </div>
              <div className="care-team-role">{member.role}</div>
              <div className="care-team-contact">
                {member.phone && (
                  <a href={`tel:${member.phone}`}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.05 1.19h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.92 16z" />
                    </svg>
                    {member.phone}
                  </a>
                )}
                {member.email && (
                  <a href={`mailto:${member.email}`}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    {member.email}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Warning signs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ paddingBottom: 16 }}>
          <div>
            <div className="card-title">⚠️ When to Seek Urgent Help</div>
            <div className="card-subtitle">Contact your care team or call 911 immediately</div>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="warning-signs-grid">
            {URGENT_WARNING_SIGNS.map((sign, i) => (
              <div key={i} className="warning-sign-item">
                <span style={{ fontSize: 18 }}>{sign.icon}</span>
                <span>{sign.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Emergency CTA */}
      <div className="emergency-cta">
        <div>
          <div className="emergency-cta-text">In a medical emergency</div>
          <div className="emergency-cta-sub">Don't wait — call emergency services immediately</div>
        </div>
        <a href="tel:911" className="emergency-cta-btn">
          📞 Call 911
        </a>
      </div>
    </div>
  )
}
