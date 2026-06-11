import type { ReactNode } from 'react'
import {
  Droplets,
  HeartPulse,
  Phone,
  Thermometer,
  TriangleAlert,
  UserRound,
  Wind,
  Zap,
} from 'lucide-react'
import type { CareTeamMember } from '../types'
import { URGENT_WARNING_SIGNS } from '../data/mockData'
import { warningSignsForCondition } from '../data/recoveryPlans'

interface CareTeamPanelProps {
  careTeam: CareTeamMember[]
  // Cloned journey profiles carry no care_team list; the assigned clinician
  // string (for example "Dr. Helen Park (Cardiology)") backs a fallback card.
  clinician?: string | null
  // Selects condition-specific urgent warning signs; the surgical defaults
  // fit the knee journey and demo mode.
  dischargeReason?: string | null
}

// Decorative icon per warning sign, matched on the label keywords.
function warningIcon(label: string): ReactNode {
  const l = label.toLowerCase()
  if (l.includes('fever')) return <Thermometer size={17} />
  if (l.includes('chest')) return <HeartPulse size={17} />
  if (l.includes('breath')) return <Wind size={17} />
  if (l.includes('calf')) return <Zap size={17} />
  if (l.includes('wound')) return <Droplets size={17} />
  return <TriangleAlert size={17} />
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function CareTeamPanel({ careTeam, clinician, dischargeReason }: CareTeamPanelProps) {
  const warningSigns =
    warningSignsForCondition(dischargeReason) ?? URGENT_WARNING_SIGNS.map((s) => s.label)
  const clinicianMatch = clinician?.match(/^(.*?)\s*\((.*)\)\s*$/)
  const fallback =
    careTeam.length === 0 && clinician
      ? {
          name: (clinicianMatch?.[1] ?? clinician).trim(),
          role: clinicianMatch?.[2]?.trim() ?? 'Attending clinician',
        }
      : null
  return (
    <div>
      {/* Care team cards */}
      <div className="care-team-grid" style={{ marginBottom: 24 }}>
        {careTeam.map((member) => {
          return (
            <div key={member.id} className="care-team-member-card">
              <div className="care-team-avatar">{getInitials(member.name)}</div>
              <div className="care-team-name">{member.name}</div>
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
        {fallback && (
          <div className="care-team-member-card">
            <div className="care-team-avatar">
              {getInitials(fallback.name.replace(/^Dr\.?\s+/i, ''))}
            </div>
            <div className="care-team-name">{fallback.name}</div>
            <div className="care-team-role">{fallback.role}</div>
            <div className="care-team-contact">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <UserRound size={12} /> Reach them through Maya or your discharge papers
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Warning signs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ paddingBottom: 16 }}>
          <div>
            <div className="card-title flex items-center gap-2">
              <TriangleAlert size={17} /> When to Seek Urgent Help
            </div>
            <div className="card-subtitle">Contact your care team or call 911 immediately</div>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="warning-signs-grid">
            {warningSigns.map((label, i) => (
              <div key={i} className="warning-sign-item">
                <span style={{ display: 'flex' }}>{warningIcon(label)}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Emergency CTA */}
      <div className="emergency-cta">
        <div>
          <div className="emergency-cta-text">In a medical emergency</div>
          <div className="emergency-cta-sub">Don't wait. Call emergency services immediately</div>
        </div>
        <a href="tel:911" className="emergency-cta-btn">
          <Phone size={14} style={{ display: 'inline', verticalAlign: -2 }} /> Call 911
        </a>
      </div>
    </div>
  )
}
