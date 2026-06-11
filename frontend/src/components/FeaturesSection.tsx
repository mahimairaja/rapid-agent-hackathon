import { useState } from 'react'
import { HOW_IT_WORKS } from '../data/landingContent'

interface FeaturesSectionProps {
  onJoin: () => void
}

export function FeaturesSection({ onJoin }: FeaturesSectionProps) {
  const [activeFeature, setActiveFeature] = useState(0)

  function getIcon(name: string) {
    switch (name) {
      case 'clipboard':
        return (
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M15 2H9v4h6V2z" />
        )
      case 'message':
        return <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      case 'activity':
        return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      case 'shield':
        return <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      case 'calendar':
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </>
        )
      case 'mic':
        return (
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )
      case 'eye':
        return (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )
      default:
        return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    }
  }

  const currentWidget = HOW_IT_WORKS[activeFeature].widget || HOW_IT_WORKS[2].widget

  return (
    <section className="landing-features" id="features">
      <h2 className="landing-features-head">
        Everything you need to recover, connect, and thrive at home
      </h2>
      <div className="landing-features-split">
        <div className="landing-features-visual">
          <div
            className="landing-features-floating-card"
            key={activeFeature}
            style={{ animation: 'slide-up 0.3s ease' }}
          >
            <div className="floating-card-header">
              <span>{currentWidget.title}</span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {getIcon(currentWidget.icon)}
              </svg>
            </div>
            <div className="floating-card-body">
              <div className="floating-card-val">
                {currentWidget.val}
                <span style={{ fontSize: '24px' }}>{currentWidget.valSuffix}</span>
              </div>
              <div className="floating-card-lbl">{currentWidget.lbl}</div>
            </div>
          </div>
        </div>
        <div className="landing-features-list">
          {HOW_IT_WORKS.map((item, index) => (
            <div
              key={item.step}
              className={`landing-feature-item ${activeFeature === index ? 'active' : ''}`}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <div className="landing-feature-content">
                <div className="landing-feature-title">{item.title}</div>
                <div className="landing-feature-text">{item.text}</div>
              </div>
              <div className="landing-feature-num">00{index + 1}</div>
            </div>
          ))}
          <div className="landing-feature-action">
            <button type="button" className="landing-feature-explore-btn" onClick={() => onJoin()}>
              <span className="dot"></span> Explore features
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
