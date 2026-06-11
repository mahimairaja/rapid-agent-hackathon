import React, { useState } from 'react'

const SOLUTION_PILLARS = [
  {
    title: 'Data Integrations',
    text: 'We integrate directly with Epic, Cerner, and other major EHRs to automatically pull patient discharge instructions securely.',
    icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    extraSVG: (
      <>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
  },
  {
    title: 'Clinically Validated AI',
    text: 'Our models are strictly fine-tuned on established clinical guidelines to ensure every answer is safe, grounded, and accurate.',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    extraSVG: null,
  },
  {
    title: 'Omnichannel Access',
    text: 'No new apps to download. We deliver proactive care directly to patients via SMS text, WhatsApp, or natural voice calls.',
    icon: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    extraSVG: <line x1="12" y1="18" x2="12.01" y2="18" />,
  },
]

export function SolutionSection() {
  const [activePillar, setActivePillar] = useState(0)

  return (
    <section className="landing-solution">
      <div className="landing-solution-inner">
        <div className="solution-split">
          <div className="solution-visual">
            <div className="solution-image-wrapper">
              {/* Healthcare professionals reviewing data */}
              <img
                src="https://images.pexels.com/photos/3845129/pexels-photo-3845129.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Healthcare professionals reviewing data"
              />
            </div>
            <div
              className="solution-floating-card"
              key={activePillar}
              style={{ animation: 'slide-up 0.3s ease' }}
            >
              <div className="solution-card-header">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--blue-500)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={SOLUTION_PILLARS[activePillar].icon} />
                  {SOLUTION_PILLARS[activePillar].extraSVG}
                </svg>
                <span>{SOLUTION_PILLARS[activePillar].title}</span>
              </div>
              <div className="solution-card-body">
                <div className="solution-card-chart">
                  <div className="chart-bar" style={{ height: '40%' }}></div>
                  <div className="chart-bar" style={{ height: '70%' }}></div>
                  <div className="chart-bar" style={{ height: '50%' }}></div>
                  <div className="chart-bar" style={{ height: '90%' }}></div>
                  <div className="chart-bar" style={{ height: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="solution-content">
            <div className="solution-eyebrow">INTEGRATION & SCALE</div>
            <h2 className="landing-solution-title">Built for seamless integration and scale</h2>
            <p className="landing-solution-subtitle">
              We seamlessly merge validated clinical AI with your existing systems, ensuring every
              patient gets hyper-personalized care without adding friction to your team's workflow.
            </p>

            <div className="solution-accordion">
              {SOLUTION_PILLARS.map((pillar, index) => (
                <div
                  key={pillar.title}
                  className={`solution-accordion-item ${activePillar === index ? 'active' : ''}`}
                  onMouseEnter={() => setActivePillar(index)}
                  onClick={() => setActivePillar(index)}
                >
                  <div className="solution-accordion-header">
                    <div className="solution-accordion-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={pillar.icon} />
                        {pillar.extraSVG}
                      </svg>
                    </div>
                    <div className="solution-accordion-title">{pillar.title}</div>
                    <div className="solution-accordion-chevron">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline
                          points={activePillar === index ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}
                        />
                      </svg>
                    </div>
                  </div>
                  {activePillar === index && (
                    <div className="solution-accordion-body">{pillar.text}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
