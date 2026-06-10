import React, { useState } from 'react'

const FAQS = [
  {
    question: 'How does the AI ensure medical accuracy?',
    answer:
      'Our models are strictly grounded in established clinical guidelines. We do not generate novel medical advice; instead, we retrieve and summarize clinically validated discharge instructions and protocols specific to your organization.',
  },
  {
    question: 'Do patients need to download an app?',
    answer:
      'No. We believe in zero-friction care. Patients interact with our system through channels they already use, such as SMS text messages, WhatsApp, or natural voice phone calls.',
  },
  {
    question: 'Does this integrate with our existing EHR?',
    answer:
      'Yes, we integrate seamlessly with Epic, Cerner, and other major Electronic Health Records to automatically pull patient data and sync check-in results back into your workflow.',
  },
  {
    question: 'Is patient data secure and HIPAA compliant?',
    answer:
      'Absolutely. Our infrastructure is fully HIPAA compliant, employing end-to-end encryption and strict data access controls to ensure patient health information (PHI) is always protected.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="landing-faq">
      <div className="landing-faq-inner">
        <div className="landing-faq-head">
          <h2 className="landing-faq-title">Frequently Asked Questions</h2>
          <p className="landing-faq-subtitle">
            Everything you need to know about our clinical AI and how it integrates into your care
            workflows.
          </p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className={`faq-item ${isOpen ? 'open' : ''}`}
                onClick={() => toggleFAQ(index)}
              >
                <div className="faq-question">
                  <h3>{faq.question}</h3>
                  <div className="faq-icon">
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
                      {isOpen ? (
                        <line x1="5" y1="12" x2="19" y2="12" />
                      ) : (
                        <>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>
                <div
                  className="faq-answer-wrapper"
                  style={{
                    maxHeight: isOpen ? '500px' : '0',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p className="faq-answer">{faq.answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
