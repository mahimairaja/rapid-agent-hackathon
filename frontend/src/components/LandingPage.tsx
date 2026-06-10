import { SolutionSection } from './SolutionSection'
import { FAQSection } from './FAQSection'
import { ProcessSection } from './ProcessSection'
import { FeaturesSection } from './FeaturesSection'

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

      <ProcessSection onJoin={onJoin} />
      <FeaturesSection onJoin={onJoin} />

      <SolutionSection />

      <FAQSection />

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
