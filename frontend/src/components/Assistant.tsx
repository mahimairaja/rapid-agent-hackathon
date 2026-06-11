import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Mic,
  Sparkles,
  Square,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { ChatMessage, SessionContext, SourceItem } from '../types'
import { VoiceClient, type TranscriptRole, type VoiceState } from '../lib/ws'
import { useAudioAnalyser } from '../lib/useAudioAnalyser'
import { getSessionContext } from '../api/client'
import { toolLabel } from '../data/toolLabels'
import { AudioVisualizer } from './AudioVisualizer'
import { GroundingPanel } from './GroundingPanel'

const SUGGESTED_FIRST: string[] = [
  "I'm Margaret Chen, born 1948-03-12",
  'My patient code is HW-1001',
]

const FOLLOW_UPS: string[] = [
  'What medications do I take today?',
  'When is my next appointment?',
  'Can I climb stairs this week?',
]

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Offline',
  connecting: 'Connecting…',
  connected: 'Ready — type or tap the mic',
  listening: 'Listening…',
  speaking: 'Speaking…',
  error: 'Connection problem',
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function renderText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function sourceLabel(s: SourceItem): string | null {
  switch (s.type) {
    case 'medication':
      return s.name ? `💊 ${s.name}` : null
    case 'appointment':
      return `📅 ${s.kind || 'Appointment'}`
    case 'care_plan':
      return `📋 ${s.source_file || 'Care plan'}`
    case 'plan':
      return '🩺 Discharge plan'
    case 'symptom':
      return `🚩 ${s.rule_id || 'Symptom'}`
    default:
      return null
  }
}

function makeGreeting(userName?: string | null, onboarded?: boolean): ChatMessage {
  const content = onboarded
    ? `Welcome back${userName ? `, **${userName}**` : ''} — I'm Maya, and I'm loading your recovery plan now. Talk or type any time: medications, appointments, symptoms, or anything in your plan.`
    : "Hi, I'm **Maya**, your recovery companion. I can talk or chat. To pull up your plan, tell me your **name and date of birth**, or your **patient code** — say it or type it below."
  return { id: 'greeting', role: 'assistant', content, timestamp: new Date() }
}

interface AssistantProps {
  // Fired whenever the live session's grounding context loads, so the rest of
  // the app (dashboard, medications, appointments) can hydrate from the
  // conversation once the patient is identified.
  onContext?: (ctx: SessionContext) => void
  // Fired with the live session id, so the app can drive session-scoped
  // surfaces (the appointments calendar widget).
  onSession?: (sessionId: string) => void
  // Onboarded accounts: deterministically identify every new live session
  // (first connect and reconnects) with this patient code.
  identifyCode?: string | null
  // Display name for the personalized greeting.
  userName?: string | null
  // A message handed in from elsewhere in the app (e.g. the symptom check-in
  // form) to send into the live conversation; consumed exactly once.
  outboundText?: string | null
  onOutboundConsumed?: () => void
}

export function Assistant({
  onContext,
  onSession,
  identifyCode,
  userName,
  outboundText,
  onOutboundConsumed,
}: AssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    makeGreeting(userName, Boolean(identifyCode)),
  ])
  const [liveUser, setLiveUser] = useState('')
  const [liveAssistant, setLiveAssistant] = useState('')
  const [input, setInput] = useState('')
  const [state, setState] = useState<VoiceState>('connecting')
  const [error, setError] = useState('')
  const [micActive, setMicActive] = useState(false)
  const [muted, setMuted] = useState(false)
  // True between sending a message and the first sign of a reply, so the
  // transcript shows typing dots instead of dead air.
  const [awaitingReply, setAwaitingReply] = useState(false)
  // Fullscreen voice view: opens with the mic, can be minimized while the
  // conversation keeps running in the bar.
  const [voiceFocus, setVoiceFocus] = useState(false)
  const [context, setContext] = useState<SessionContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [highlights, setHighlights] = useState<SourceItem[]>([])
  // Bumped on every sources frame so the panel replays its pulse animation
  // even when the same item is cited twice in a row.
  const [highlightTick, setHighlightTick] = useState(0)

  const clientRef = useRef<VoiceClient | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // Monotonic id for context fetches: only the latest in-flight request may
  // commit, so a slow older response can never overwrite newer data.
  const loadSeqRef = useRef(0)
  const liveUserRef = useRef('')
  const liveAssistantRef = useRef('')
  const pendingSourcesRef = useRef<SourceItem[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // The connection effect runs once; keep the latest props reachable from it.
  const onContextRef = useRef(onContext)
  const onSessionRef = useRef(onSession)
  const identifyCodeRef = useRef(identifyCode ?? null)
  useEffect(() => {
    onContextRef.current = onContext
    onSessionRef.current = onSession
    identifyCodeRef.current = identifyCode ?? null
    clientRef.current?.setIdentifyCode(identifyCode ?? null)
  }, [onContext, onSession, identifyCode])

  const levels = useAudioAnalyser(clientRef, state)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveUser, liveAssistant, awaitingReply])

  useEffect(() => {
    // Guards async callbacks from a disconnected client (StrictMode double-mount
    // or a fast remount) from writing into the live component's state.
    let cancelled = false

    const commit = (role: 'user' | 'assistant', content: string) => {
      const text = content.trim()
      if (cancelled || !text) return
      const sources =
        role === 'assistant' && pendingSourcesRef.current.length
          ? pendingSourcesRef.current
          : undefined
      if (role === 'assistant') pendingSourcesRef.current = []
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role, content: text, timestamp: new Date(), sources },
      ])
    }

    const loadContext = async (attempt = 0): Promise<void> => {
      const sid = sessionIdRef.current
      if (!sid) return
      const seq = ++loadSeqRef.current
      setContextLoading(true)
      const ctx = await getSessionContext(sid)
      // Drop stale responses: only the latest request may commit, so a slow
      // pre-booking snapshot cannot roll back a fresher one.
      if (cancelled || seq !== loadSeqRef.current) return
      setContextLoading(false)
      if (ctx.verified) {
        setContext(ctx)
        onContextRef.current?.(ctx)
        return
      }
      // loadContext only runs after an identity/appointment source, so an
      // unverified answer here is a transient failure (network blip, write not
      // yet visible). Keep an already-verified panel and retry once.
      setContext((prev) => (prev?.verified ? prev : ctx))
      if (attempt === 0) {
        setTimeout(() => {
          if (!cancelled) void loadContext(1)
        }, 1500)
      }
    }

    const client = new VoiceClient({
      onState: (s) => {
        if (!cancelled) setState(s)
      },
      onError: (msg) => {
        if (!cancelled) {
          setError(msg)
          setAwaitingReply(false)
        }
      },
      onSession: (sid) => {
        sessionIdRef.current = sid
        if (!cancelled) onSessionRef.current?.(sid)
      },
      onIdentifyFailed: () => {
        if (!cancelled) {
          setError(
            "I couldn't load your saved profile automatically — tell me who you are instead.",
          )
        }
      },
      onTranscript: (text: string, final: boolean, role: TranscriptRole) => {
        if (role === 'assistant' && !cancelled) setAwaitingReply(false)
        const liveRef = role === 'user' ? liveUserRef : liveAssistantRef
        const setLive = role === 'user' ? setLiveUser : setLiveAssistant
        if (final) {
          // The final frame carries the full utterance, so replace (don't append)
          // the accumulated deltas; fall back to the buffer if it is empty.
          commit(role, text || liveRef.current)
          liveRef.current = ''
          if (!cancelled) setLive('')
        } else {
          liveRef.current += text
          if (!cancelled) setLive(liveRef.current)
        }
      },
      onTurnComplete: () => {
        if (!cancelled) setAwaitingReply(false)
        // Safety net: commit any partials still buffered if no final arrived.
        if (liveUserRef.current.trim()) {
          commit('user', liveUserRef.current)
          liveUserRef.current = ''
          if (!cancelled) setLiveUser('')
        }
        if (liveAssistantRef.current.trim()) {
          commit('assistant', liveAssistantRef.current)
          liveAssistantRef.current = ''
          if (!cancelled) setLiveAssistant('')
        }
        // A tool whose response frame never arrived must not spin forever.
        if (!cancelled) {
          setMessages((prev) =>
            prev.some((m) => m.kind === 'tool' && m.toolStatus === 'running')
              ? prev.map((m) =>
                  m.kind === 'tool' && m.toolStatus === 'running'
                    ? { ...m, toolStatus: 'done' as const }
                    : m,
                )
              : prev,
          )
        }
      },
      onInterrupted: () => {
        // Barge-in cut the assistant mid-reply: discard the stranded partial so
        // it does not bleed into the next turn's bubble.
        liveAssistantRef.current = ''
        if (!cancelled) setLiveAssistant('')
      },
      onSources: (items: SourceItem[]) => {
        if (cancelled) return
        setHighlights(items)
        setHighlightTick((t) => t + 1)
        pendingSourcesRef.current = items.filter((i) => i.type !== 'identity')
        if (items.some((i) => i.type === 'identity' || i.type === 'appointment')) {
          void loadContext()
        }
      },
      onTool: (tool, status) => {
        if (cancelled) return
        setMessages((prev) => {
          if (status === 'done') {
            // Resolve the most recent running chip for this tool in place, so
            // the timeline reads call -> done instead of stacking duplicates.
            for (let i = prev.length - 1; i >= 0; i--) {
              const m = prev[i]
              if (m.kind === 'tool' && m.tool === tool && m.toolStatus === 'running') {
                const next = [...prev]
                next[i] = { ...m, toolStatus: 'done' }
                return next
              }
            }
          }
          return [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              kind: 'tool',
              tool,
              toolStatus: status,
            },
          ]
        })
      },
    })
    client.setIdentifyCode(identifyCodeRef.current)
    clientRef.current = client
    void client.connect()

    return () => {
      cancelled = true
      void client.disconnect()
      clientRef.current = null
    }
  }, [])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'user', content: t, timestamp: new Date() },
    ])
    // The client queues text typed while disconnected; kick off the reconnect
    // so the queued message is delivered on the fresh session instead of
    // silently going nowhere.
    clientRef.current?.sendText(t)
    if (state === 'idle' || state === 'error') {
      void reconnect()
    }
    setAwaitingReply(true)
    setInput('')
    inputRef.current?.focus()
  }

  const toggleMic = async () => {
    const client = clientRef.current
    if (!client) return
    setError('')
    if (client.isMicActive()) {
      client.stopMic()
      setVoiceFocus(false)
    } else {
      await client.startMic()
      if (client.isMicActive()) setVoiceFocus(true)
    }
    setMicActive(client.isMicActive())
  }

  const endVoice = () => {
    clientRef.current?.stopMic()
    setMicActive(false)
    setVoiceFocus(false)
  }

  const toggleMute = () => {
    const client = clientRef.current
    if (!client) return
    const next = !client.isMuted()
    client.setMuted(next)
    setMuted(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  // The live session can drop (idle timeout, network). Reconnecting opens a
  // fresh session under the same transcript; a previously identified patient
  // is nudged to re-identify since identity lives in the session.
  const reconnect = async () => {
    const client = clientRef.current
    if (!client) return
    const wasVerified = Boolean(context?.verified)
    setError('')
    setMicActive(false)
    // Identity lives in the session and the old session is gone, so clear all
    // session-scoped state first: the dead session id (a stray context fetch
    // must not resurrect the old patient), in-flight fetches, and the panel.
    sessionIdRef.current = null
    loadSeqRef.current++
    pendingSourcesRef.current = []
    setHighlights([])
    setContext(null)
    // Full teardown then a fresh connect: the transcript lives in this
    // component, so only the underlying conversation session is replaced.
    await client.disconnect()
    // The component may have unmounted (logout, role switch) while waiting; a
    // socket opened now would have no owner left to close it.
    if (clientRef.current !== client) return
    await client.connect()
    // Onboarded accounts re-identify automatically (the client sends the
    // identify frame on the new session), so only walk-in users get the nudge.
    if (wasVerified && !identifyCodeRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content:
            "We got disconnected for a moment, so I started a fresh session. Remind me who you are — your **name and date of birth**, or your **patient code** — and I'll pick right back up.",
          timestamp: new Date(),
        },
      ])
    }
  }

  // Deliver a message handed in from another tab (symptom check-in) exactly
  // once; the conversation surface stays the single place answers appear.
  useEffect(() => {
    if (!outboundText) return
    void (async () => {
      send(outboundText)
      onOutboundConsumed?.()
    })()
    // send/onOutboundConsumed are recreated per render but stable per consume
    // cycle; keying on the text keeps this to one delivery per message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundText])

  const hasUserTurn = messages.some((m) => m.role === 'user')
  // Onboarded accounts never need the identification chips.
  const chips = hasUserTurn || identifyCode ? FOLLOW_UPS : SUGGESTED_FIRST
  const live = state === 'listening' || state === 'speaking'
  const offline = state === 'idle' || state === 'error'

  // Drives the voice-overlay orb: one smoothed loudness value from the bars.
  const orbLevel = levels.reduce((a, b) => a + b, 0) / (levels.length || 1)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const voiceCaption = (liveAssistant || liveUser || lastAssistant?.content || '').replace(
    /\*\*/g,
    '',
  )

  // Cite-on-click: clicking a source chip re-pulses the matching panel item.
  const focusSource = (s: SourceItem) => {
    setHighlights([s])
    setHighlightTick((t) => t + 1)
  }

  return (
    <div className="assistant-shell">
      <div className="assistant-main card">
        <div className="assistant-statusbar">
          <span
            className={`badge ${
              live ? 'badge-green live-dot' : offline ? 'badge-amber' : 'badge-blue'
            }`}
          >
            {live ? 'Live' : offline ? 'Offline' : 'Ready'}
          </span>
          <span className="assistant-status-label" aria-live="polite">
            {STATE_LABEL[state]}
          </span>
          {offline && (
            <button type="button" className="suggestion-chip" onClick={() => void reconnect()}>
              Reconnect
            </button>
          )}
        </div>

        <div className="assistant-transcript" aria-label="Conversation">
          {messages.map((msg) =>
            msg.kind === 'tool' ? (
              <div
                key={msg.id}
                className="my-1 ml-11 flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                data-status={msg.toolStatus}
              >
                {msg.toolStatus === 'running' ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-secondary" aria-hidden="true" />
                )}
                <span>{toolLabel(msg.tool ?? '', msg.toolStatus ?? 'done')}</span>
              </div>
            ) : (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className={`chat-avatar ${msg.role}`}>
                  {msg.role === 'assistant' ? <Sparkles size={15} /> : <UserRound size={15} />}
                </div>
                <div>
                  <div
                    className={`chat-bubble${msg.role === 'assistant' ? ' chat-bubble-md' : ''}`}
                    dangerouslySetInnerHTML={
                      msg.role === 'assistant' ? { __html: renderText(msg.content) } : undefined
                    }
                  >
                    {msg.role === 'user' ? msg.content : undefined}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="source-chips">
                      {msg.sources.map((s, i) => {
                        const label = sourceLabel(s)
                        return label ? (
                          <button
                            key={i}
                            type="button"
                            className="source-chip"
                            title={s.snippet ?? 'Show this source in the panel'}
                            onClick={() => focusSource(s)}
                          >
                            {label}
                          </button>
                        ) : null
                      })}
                    </div>
                  )}
                  <div className="chat-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ),
          )}

          {liveUser && (
            <div className="chat-message user">
              <div className="chat-avatar user">
                <UserRound size={15} />
              </div>
              <div>
                <div className="chat-bubble" style={{ opacity: 0.65 }}>
                  {liveUser}
                </div>
              </div>
            </div>
          )}
          {liveAssistant && (
            <div className="chat-message assistant">
              <div className="chat-avatar assistant">
                <Sparkles size={15} />
              </div>
              <div>
                <div
                  className="chat-bubble chat-bubble-md"
                  style={{ opacity: 0.65 }}
                  dangerouslySetInnerHTML={{ __html: renderText(liveAssistant) }}
                />
              </div>
            </div>
          )}
          {awaitingReply && !liveAssistant && (
            <div className="chat-message assistant">
              <div className="chat-avatar assistant">
                <Sparkles size={15} />
              </div>
              <div className="typing-indicator-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="assistant-chips">
          {chips.map((c) => (
            <button key={c} type="button" className="suggestion-chip" onClick={() => send(c)}>
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="assistant-error">
            {error}
          </div>
        )}

        <div className="assistant-bar">
          <button
            type="button"
            className={`voice-mic-btn${micActive ? ' active' : ''}`}
            onClick={() => void toggleMic()}
            aria-pressed={micActive}
            aria-label={micActive ? 'Stop talking' : 'Start talking'}
            title={micActive ? 'Stop talking' : 'Start talking'}
          >
            {micActive ? <Square size={15} /> : <Mic size={17} />}
          </button>

          {micActive && !voiceFocus ? (
            <button
              type="button"
              className="voice-expand"
              onClick={() => setVoiceFocus(true)}
              title="Expand voice view"
              aria-label="Expand voice view"
            >
              <AudioVisualizer levels={levels} state={state} />
            </button>
          ) : (
            <AudioVisualizer levels={levels} state={state} />
          )}

          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-label="Message"
          />
          <button
            type="button"
            className="chat-send-btn"
            onClick={() => send(input)}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          <button
            type="button"
            className={`voice-mute-btn${muted ? ' active' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute audio' : 'Mute audio (keep transcript)'}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>

        {/* Standing disclaimer: Maya never repeats this in replies. */}
        <p className="px-4 pb-3 pt-1 text-center text-xs text-muted-foreground">
          Maya shares guidance from your care plan, not medical advice. In an emergency, call 911.
        </p>
      </div>

      <GroundingPanel
        context={context}
        highlights={highlights}
        highlightTick={highlightTick}
        loading={contextLoading}
      />

      {voiceFocus && (
        <div className="voice-overlay" role="dialog" aria-label="Voice conversation">
          <div className="voice-overlay-state">{STATE_LABEL[state]}</div>
          <div
            className={`voice-orb${state === 'speaking' ? ' speaking' : ''}`}
            style={{ transform: `scale(${1 + Math.min(orbLevel, 1) * 0.45})` }}
            aria-hidden="true"
          />
          <div className="voice-overlay-caption" aria-live="polite">
            {voiceCaption}
          </div>
          <div className="voice-overlay-controls">
            <button
              type="button"
              className="voice-overlay-btn"
              onClick={() => setVoiceFocus(false)}
            >
              Minimize
            </button>
            <button type="button" className="voice-overlay-btn end" onClick={endVoice}>
              ■ End voice
            </button>
            <button
              type="button"
              className={`voice-overlay-btn${muted ? ' active' : ''}`}
              onClick={toggleMute}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
