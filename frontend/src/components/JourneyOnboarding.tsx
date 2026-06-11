import { useEffect, useState } from 'react'
import type { ClaimResponse, Journey } from '../types'
import { claimJourney, getJourneys } from '../api/client'
import { JOURNEY_IMAGES } from '../data/journeyImages'
import { buildStagesFromClaim, playStages, type BuildStage } from '../lib/journeyBuild'
import { JourneyBuildStages } from './JourneyBuildStages'

interface JourneyOnboardingProps {
  token: string
  initialName: string
  onComplete: (claim: ClaimResponse) => void
  onLogout: () => void
}

/**
 * First-login onboarding: a Hugging Face-style gallery of sample recovery
 * journeys. Picking one clones the sample's medical content into the account's
 * personal profile (the user's name, the sample's medicine + knowledge base)
 * and plays a staged "building your knowledge base" sequence driven by the
 * claim response counts.
 */
export function JourneyOnboarding({
  token,
  initialName,
  onComplete,
  onLogout,
}: JourneyOnboardingProps) {
  const [journeys, setJourneys] = useState<Journey[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState(initialName)
  const [birthYear, setBirthYear] = useState('')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimError, setClaimError] = useState('')
  const [stages, setStages] = useState<BuildStage[]>([])
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getJourneys()
        if (!cancelled) {
          setJourneys(list)
          if (list.length === 0) {
            setLoadError('Sample journeys are not seeded yet — run the seed script, then reload.')
          }
        }
      } catch {
        if (!cancelled) setLoadError('Could not load the sample journeys. Is the backend running?')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pick = async (journey: Journey) => {
    const displayName = name.trim()
    if (!displayName) {
      setClaimError('Add your name first — your plan is personalized to it.')
      return
    }
    const year = birthYear.trim() ? Number(birthYear.trim()) : null
    if (year !== null && (Number.isNaN(year) || year < 1900 || year > new Date().getFullYear())) {
      setClaimError('Birth year looks off — use a 4-digit year, or leave it empty.')
      return
    }
    setClaimError('')
    setClaiming(journey.journey_code)
    try {
      const claim = await claimJourney(
        { journey_code: journey.journey_code, display_name: displayName, birth_year: year },
        token,
      )
      // Stage the build sequence from the real counts, then hand off.
      const built = buildStagesFromClaim(claim)
      setStages(built)
      playStages(built.length, setStageIndex, () => onComplete(claim))
    } catch (err) {
      setClaiming(null)
      setClaimError(
        err instanceof Error ? err.message : 'Could not create your profile. Try again.',
      )
    }
  }

  if (stages.length > 0) {
    return (
      <div className="journey-screen">
        <JourneyBuildStages stages={stages} stageIndex={stageIndex} />
      </div>
    )
  }

  return (
    <div className="journey-screen">
      <div className="journey-header">
        <div className="journey-eyebrow">Welcome to Rapid Recovery</div>
        <h1 className="journey-title">Choose a recovery journey to begin</h1>
        <p className="journey-sub">
          This is a demo, so you don't need to bring a discharge document — pick a sample journey
          and we'll build a personal recovery plan and knowledge base around <strong>your</strong>{' '}
          name. Your assistant will ground every answer in it.
        </p>
      </div>

      <div className="journey-identity">
        <label className="journey-field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            maxLength={80}
          />
        </label>
        <label className="journey-field journey-field-year">
          <span>Birth year (optional)</span>
          <input
            type="text"
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g. 1990"
            maxLength={4}
          />
        </label>
      </div>

      {(claimError || loadError) && (
        <div role="alert" className="journey-error">
          {claimError || loadError}
        </div>
      )}

      <div className="journey-grid">
        {journeys === null && <div className="journey-loading">Loading sample journeys…</div>}
        {(journeys ?? []).map((journey) => (
          <button
            key={journey.journey_code}
            type="button"
            className="journey-card card"
            onClick={() => void pick(journey)}
            disabled={claiming !== null}
          >
            <div className="journey-card-media" aria-hidden="true">
              <span className="journey-card-icon">{journey.icon}</span>
              {JOURNEY_IMAGES[journey.journey_code] && (
                <img
                  src={JOURNEY_IMAGES[journey.journey_code]}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
            </div>
            <div className="journey-card-title">{journey.title}</div>
            <div className="journey-card-condition">{journey.condition}</div>
            <div className="journey-card-meta">
              <span>{journey.medication_count} medications</span>
              <span>{journey.appointment_kinds.join(' · ') || 'Follow-up'}</span>
              <span>{journey.clinician}</span>
            </div>
            <div className="journey-card-cta">
              {claiming === journey.journey_code ? 'Creating…' : 'Start this journey →'}
            </div>
          </button>
        ))}
      </div>

      <button type="button" className="journey-logout" onClick={onLogout}>
        Sign out
      </button>
    </div>
  )
}
