import { HOW_IT_WORKS, LANDING_JOURNEYS } from '../data/landingContent'

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
        <button
          type="button"
          id="landing-login-btn"
          className="landing-login-btn"
          onClick={onLogin}
        >
          Log in
        </button>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>Recover at home, never alone.</h1>
          <p>
            An AI care assistant that knows your discharge plan, answers day or night, and books
            your follow-ups for you.
          </p>
          <button
            type="button"
            id="landing-join-btn"
            className="btn btn-primary landing-join-btn"
            onClick={() => onJoin()}
          >
            Join →
          </button>
          <span className="landing-hero-hint">Demo platform · synthetic data only</span>
        </div>
      </section>

      <section className="landing-strip">
        <h2 className="landing-strip-title">How it works</h2>
        <div className="landing-steps">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="landing-step card">
              <div className="landing-step-num">{item.step}</div>
              <div className="landing-step-title">{item.title}</div>
              <div className="landing-step-text">{item.text}</div>
            </div>
          ))}
        </div>

        <h2 className="landing-strip-title">Choose a journey to try</h2>
        <div className="landing-journeys">
          {LANDING_JOURNEYS.map((j) => (
            <button
              key={j.journey_code}
              type="button"
              className="landing-journey-card card"
              onClick={() => onJoin(j.journey_code)}
            >
              <div className="landing-journey-media" aria-hidden="true">
                <span className="landing-journey-emoji">{j.emoji}</span>
                <img
                  src={j.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="landing-journey-body">
                <div className="landing-journey-title">{j.title}</div>
                <div className="landing-journey-blurb">{j.blurb}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span>This platform uses synthetic data for demonstration purposes.</span>
        <span>Photos from Pexels</span>
      </footer>
    </div>
  )
}
