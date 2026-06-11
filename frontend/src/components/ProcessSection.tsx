
import { ONBOARDING_PROCESS, LANDING_JOURNEYS } from '../data/landingContent'

interface ProcessSectionProps {
  onJoin: (journeyCode?: string) => void
}

export function ProcessSection({ onJoin }: ProcessSectionProps) {
  return (
    <section className="landing-process" id="how-it-works">
      <div className="landing-process-inner">
        <div className="landing-process-left">
          <div className="process-eyebrow">HOW IT WORKS</div>
          <h2 className="process-title">Your Path to Recovery</h2>
          <p className="process-desc">
            We make it easy to transition from the hospital to your home. Our app guides you every
            step of the way with personalized care.
          </p>
          <button type="button" className="process-cta-btn" onClick={() => onJoin()}>
            Get Started →
          </button>
          <div className="process-visual"></div>
        </div>

        <div className="landing-process-right">
          <div className="process-timeline-line"></div>
          <div className="process-steps">
            {ONBOARDING_PROCESS.map((item, index) => (
              <div key={item.step} className="process-step-container">
                <div className="process-step-node">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {index === 0 && <circle cx="12" cy="12" r="10" />}
                    {index === 1 && <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />}
                    {index === 1 && <circle cx="12" cy="7" r="4" />}
                    {index === 2 && <ellipse cx="12" cy="5" rx="9" ry="3" />}
                    {index === 2 && <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />}
                    {index === 2 && <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />}
                    {index === 3 && <polyline points="20 6 9 17 4 12" />}
                  </svg>
                </div>
                <div className="process-step-card">
                  <div className="process-step-badge">STEP - {item.step}</div>
                  <div className="process-step-title">{item.title}</div>
                  <div className="process-step-text">{item.text}</div>
                  {/* Abstract graphics based on index */}
                  <div className="process-card-graphic">
                    {index === 0 && (
                      <div
                        className="landing-journeys"
                        style={{ width: '100%', marginTop: '16px' }}
                      >
                        {LANDING_JOURNEYS.map((j) => (
                          <button
                            key={j.journey_code}
                            type="button"
                            className="landing-journey-card card"
                            onClick={() => onJoin(j.journey_code)}
                          >
                            <div
                              className="landing-journey-media"
                              aria-hidden="true"
                              style={{ height: '90px' }}
                            >
                              <span className="landing-journey-emoji" style={{ fontSize: '28px' }}>
                                {j.emoji}
                              </span>
                              <img
                                src={j.image}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                            <div className="landing-journey-body" style={{ padding: '12px' }}>
                              <div
                                className="landing-journey-title"
                                style={{ fontSize: '13px', marginBottom: '4px' }}
                              >
                                {j.title}
                              </div>
                              <div
                                className="landing-journey-blurb"
                                style={{ fontSize: '11px', lineHeight: '1.4' }}
                              >
                                {j.blurb}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {index === 1 && (
                      <div className="graphic-bar-container">
                        <div className="graphic-bar"></div>
                        <div className="graphic-circle"></div>
                      </div>
                    )}
                    {index === 2 && (
                      <div className="graphic-knowledge">
                        <span className="dot blue"></span>
                        <span className="dot teal"></span>
                        <span className="dot amber"></span>
                      </div>
                    )}
                    {index === 3 && (
                      <div className="graphic-chat">
                        <div className="bubble left"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
