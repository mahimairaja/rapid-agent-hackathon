import { useEffect, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import type { ClaimResponse, Journey } from '../types'
import { ApiError, claimJourney, getJourneys, login, signUp } from '../api/client'
import { JOURNEY_IMAGES } from '../data/journeyImages'
import { buildStagesFromClaim, playStages, type BuildStage } from '../lib/journeyBuild'
import { JourneyBuildStages } from './JourneyBuildStages'

type StepId = 'name' | 'journey' | 'birth-year' | 'email' | 'password'

const STEPS: StepId[] = ['name', 'journey', 'birth-year', 'email', 'password']

const QUESTIONS: Record<StepId, string> = {
  name: 'What should we call you?',
  journey: 'Which recovery journey are you on?',
  'birth-year': 'What year were you born?',
  email: 'What is your email?',
  password: 'Create a password',
}

const INVALID_MSG: Record<StepId, string> = {
  name: 'Add your name first: your plan is personalized to it.',
  journey: 'Pick a journey to continue.',
  'birth-year': 'Use a 4-digit year between 1900 and this year, or skip.',
  email: 'That email does not look right yet.',
  password: 'Use at least 8 characters.',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface JoinWizardProps {
  preselectedJourney: string | null
  onComplete: (token: string, claim: ClaimResponse) => void
  onBack: () => void
  onLoginInstead: () => void
}

/**
 * Typeform-style signup: one question per full-screen step, Enter advances.
 * Finishing runs signUp -> login -> claimJourney, plays the shared staged
 * build timeline, then hands the token and claim to the App.
 */
export function JoinWizard({
  preselectedJourney,
  onComplete,
  onBack,
  onLoginInstead,
}: JoinWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [name, setName] = useState('')
  const [journeyCode, setJourneyCode] = useState<string | null>(preselectedJourney)
  const [birthYear, setBirthYear] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [showLoginLink, setShowLoginLink] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Set once the account exists; a later claim failure retries only the claim.
  const [authedToken, setAuthedToken] = useState<string | null>(null)

  const [journeys, setJourneys] = useState<Journey[] | null>(null)
  const [journeysError, setJourneysError] = useState(false)
  const [fetchTick, setFetchTick] = useState(0)

  const [stages, setStages] = useState<BuildStage[]>([])
  const [stageIndex, setStageIndex] = useState(0)

  // Prefetch journeys on mount (and on Retry) so step 2 is instant.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getJourneys()
        if (!cancelled) {
          setJourneys(list)
          setJourneysError(list.length === 0)
        }
      } catch {
        if (!cancelled) setJourneysError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchTick])

  const step = STEPS[stepIndex]

  const stepValid = (id: StepId): boolean => {
    switch (id) {
      case 'name':
        return name.trim().length > 0
      case 'journey':
        return journeyCode !== null
      case 'birth-year': {
        const t = birthYear.trim()
        if (!t) return true
        const y = Number(t)
        return /^\d{4}$/.test(t) && y >= 1900 && y <= new Date().getFullYear()
      }
      case 'email':
        return EMAIL_RE.test(email.trim())
      case 'password':
        return password.length >= 8
    }
  }

  const submit = async () => {
    if (submitting) return
    setError('')
    setShowLoginLink(false)
    setSubmitting(true)
    try {
      let tk = authedToken
      if (!tk) {
        try {
          await signUp(email.trim(), password, name.trim())
        } catch (err) {
          if (err instanceof ApiError && err.status === 400) {
            // Most common cause: the email is already registered.
            setSubmitting(false)
            setStepIndex(STEPS.indexOf('email'))
            setError(err.message || 'That email may already be registered.')
            setShowLoginLink(true)
            return
          }
          throw err
        }
        try {
          const auth = await login(email.trim(), password)
          tk = auth.access_token
        } catch {
          setSubmitting(false)
          setError('Your account was created but sign-in failed. Use the login screen.')
          setShowLoginLink(true)
          return
        }
        setAuthedToken(tk)
      }
      const year = birthYear.trim() ? Number(birthYear.trim()) : null
      const claim = await claimJourney(
        { journey_code: journeyCode as string, display_name: name.trim(), birth_year: year },
        tk,
      )
      const built = buildStagesFromClaim(claim)
      const finalToken = tk
      setStages(built)
      playStages(built.length, setStageIndex, () => onComplete(finalToken, claim))
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Could not create your account. Try again.')
    }
  }

  const next = () => {
    if (!stepValid(step)) {
      setError(INVALID_MSG[step])
      return
    }
    setError('')
    setShowLoginLink(false)
    if (stepIndex === STEPS.length - 1) {
      void submit()
      return
    }
    setStepIndex(stepIndex + 1)
  }

  const back = () => {
    setError('')
    setShowLoginLink(false)
    if (stepIndex === 0) {
      onBack()
      return
    }
    setStepIndex(stepIndex - 1)
  }

  if (stages.length > 0) {
    return (
      <div className="join-wizard">
        <div className="join-build">
          <JourneyBuildStages stages={stages} stageIndex={stageIndex} />
        </div>
      </div>
    )
  }

  return (
    <div className="join-wizard">
      <header className="join-wizard-top">
        <button type="button" className="join-back" onClick={back} aria-label="Back">
          ←
        </button>
        <div className="join-progress" aria-hidden="true">
          <div
            className="join-progress-fill"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <span className="join-step-count">
          Step {stepIndex + 1} of {STEPS.length}
        </span>
      </header>

      <form
        key={step}
        className="join-step"
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <h1 className="join-question">{QUESTIONS[step]}</h1>

        {step === 'name' && (
          <input
            id="join-name-input"
            className="join-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            maxLength={80}
            autoFocus
          />
        )}

        {step === 'journey' && (
          <div className="join-journeys">
            {journeysError && (
              <div role="alert" className="join-error">
                Could not load the sample journeys. Is the backend running?{' '}
                <button
                  type="button"
                  className="join-link"
                  onClick={() => {
                    setJourneys(null)
                    setJourneysError(false)
                    setFetchTick((t) => t + 1)
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {journeys === null && !journeysError && (
              <div className="join-loading">Loading journeys…</div>
            )}
            {(journeys ?? []).map((j) => (
              <button
                key={j.journey_code}
                type="button"
                className={`join-journey-card card${
                  journeyCode === j.journey_code ? ' selected' : ''
                }`}
                onClick={() => {
                  setJourneyCode(j.journey_code)
                  setError('')
                  setStepIndex(stepIndex + 1)
                }}
              >
                <div className="landing-journey-media" aria-hidden="true">
                  <span className="landing-journey-emoji">{j.icon}</span>
                  {JOURNEY_IMAGES[j.journey_code] && (
                    <img
                      src={JOURNEY_IMAGES[j.journey_code]}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>
                <div className="landing-journey-body">
                  <div className="landing-journey-title">{j.title}</div>
                  <div className="join-journey-meta">
                    {j.medication_count} medications
                    {j.clinician ? ` · ${j.clinician}` : ''}
                  </div>
                </div>
              </button>
            ))}
            {/* Real product path, intentionally frozen for the demo: sample
                journeys stand in for parsed discharge documents. */}
            <div
              aria-disabled="true"
              className="col-span-full flex select-none items-center gap-3 rounded-xl border border-dashed border-input bg-muted/40 p-3.5 opacity-75"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UploadCloud className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col text-left">
                <span className="text-sm font-semibold text-muted-foreground">
                  Upload your discharge summary
                </span>
                <span className="text-xs text-muted-foreground/80">
                  Your own plan, parsed into Maya's knowledge base
                </span>
              </span>
              <span className="ml-auto shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Coming soon
              </span>
            </div>
          </div>
        )}

        {step === 'birth-year' && (
          <>
            <input
              id="join-birth-year-input"
              className="join-input"
              type="text"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g. 1990"
              maxLength={4}
              autoFocus
            />
            <button
              type="button"
              className="join-link"
              onClick={() => {
                setError('')
                setStepIndex(stepIndex + 1)
              }}
            >
              Skip this
            </button>
          </>
        )}

        {step === 'email' && (
          <input
            id="join-email-input"
            className="join-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        )}

        {step === 'password' && (
          <>
            <input
              id="join-password-input"
              className="join-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
            />
            <span className="join-hint">8 characters minimum. You will use it to log back in.</span>
          </>
        )}

        {error && step !== 'journey' && (
          <div role="alert" className="join-error">
            {error}
            {showLoginLink && (
              <button type="button" className="join-link" onClick={onLoginInstead}>
                Log in instead
              </button>
            )}
          </div>
        )}

        {(step !== 'journey' || journeyCode !== null) && (
          <button
            type="submit"
            id="join-next-btn"
            className="btn btn-primary join-next"
            disabled={submitting}
            // The journey step has no text input, so without this Enter has no
            // focused form element and cannot confirm a preselected card.
            autoFocus={step === 'journey'}
          >
            {submitting
              ? 'Creating your account…'
              : step === 'password'
                ? authedToken
                  ? 'Retry'
                  : 'Create my account'
                : 'Continue'}
          </button>
        )}
        <span className="join-enter-hint">press Enter ↵</span>
      </form>
    </div>
  )
}
