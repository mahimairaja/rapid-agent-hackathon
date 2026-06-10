import { useState } from 'react'
import { HOW_IT_WORKS, LANDING_JOURNEYS, ONBOARDING_PROCESS } from '../data/landingContent'
import { SolutionSection } from './SolutionSection'
import { FAQSection } from './FAQSection'

interface LandingPageProps {
  onJoin: (journeyCode?: string) => void
  onLogin: () => void
}

/**
 * Pre-auth front door. Pure presentation: no API calls, so it renders
 * instantly even if the backend is down. "Join" opens the typeform wizard;
 * clicking a journey card opens the wizard with that journey preselected.
 */
export function LandingPage({ onJoin, onLogin }: LandingPageProps) {
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
    <div className="landing">
      {/* Background pattern wrapper */}
      <div className="landing-hero-bg">
        <div className="landing-hero-pattern" />
        <header className="landing-header">
          <div className="landing-wordmark">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Rapid Recovery
          </div>

          <nav className="landing-nav-center">
            <a href="#how-it-works">How it Works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="landing-nav-right">
            <button type="button" className="landing-login-btn-ghost" onClick={onLogin}>
              Log in
            </button>
            <button type="button" className="landing-start-btn" onClick={() => onJoin()}>
              Start now
            </button>
          </div>
        </header>

        <section className="landing-hero-split">
          <div className="landing-hero-left">
            <h1>
              Recover at home,
              <br />
              never alone.
            </h1>
            <p>
              Rapid Recovery makes it easy to manage your post-discharge care. Your AI assistant
              knows your plan, answers your questions, and books follow-ups automatically.
            </p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-start-btn-large" onClick={() => onJoin()}>
                Start now
              </button>
              <button type="button" className="landing-demo-btn-large" onClick={onLogin}>
                View a demo
              </button>
            </div>

            <div className="landing-trust-section">
              <span>Backed by clinically validated AI</span>
              <div className="landing-trust-stats">
                <div className="trust-stat">
                  <strong>98%</strong>
                  <span>Adherence</span>
                </div>
                <div className="trust-stat">
                  <strong>24/7</strong>
                  <span>Support</span>
                </div>
                <div className="trust-stat">
                  <strong>100%</strong>
                  <span>Monitored</span>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-hero-right">
            {/* Sleek Widget Card matching inspiration */}
            <div className="hero-widget-card">
              <div className="hero-widget-header">
                <div className="hero-widget-profile">
                  <div className="hero-widget-avatar">JS</div>
                  <div className="hero-widget-info">
                    <div className="hero-widget-name">Jane Smith</div>
                    <div className="hero-widget-role">Post-Op Recovery</div>
                  </div>
                </div>
                <div className="hero-widget-stat">
                  <div className="hero-widget-stat-val">Day 4</div>
                  <div className="hero-widget-stat-lbl">Recovery Stage</div>
                </div>
              </div>

              <div className="hero-widget-main-stat">
                <div className="hero-widget-main-val">100%</div>
                <div className="hero-widget-main-lbl">Adherence today</div>
              </div>

              <div className="hero-widget-bars">
                <div className="hero-widget-bar completed" style={{ flex: 1 }}></div>
                <div className="hero-widget-bar completed" style={{ flex: 1 }}></div>
                <div className="hero-widget-bar completed" style={{ flex: 1 }}></div>
                <div className="hero-widget-bar pending" style={{ flex: 1 }}></div>
              </div>

              <div className="hero-widget-footer">
                <div className="hero-widget-footer-item">
                  <span className="hero-widget-dot blue"></span>
                  Lisinopril 10mg
                  <span className="hero-widget-time">Taken at 8:00 AM</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

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
                                <span
                                  className="landing-journey-emoji"
                                  style={{ fontSize: '28px' }}
                                >
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
              <button
                type="button"
                className="landing-feature-explore-btn"
                onClick={() => onJoin()}
              >
                <span className="dot"></span> Explore features
              </button>
            </div>
          </div>
        </div>
      </section>

      <SolutionSection />

      <FAQSection id="faq" />

      <footer className="landing-footer-proper">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="landing-wordmark">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Rapid Recovery
            </div>
            <p>
              Recover at home, never alone. Empowering patients with proactive, AI-driven
              post-discharge care.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#how-it-works">How it Works</a>
              <a href="#features">Features</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Contact Us</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Rapid Recovery. All rights reserved.</span>
          <span>Photos from Pexels</span>
        </div>
      </footer>
    </div>
  )
}
