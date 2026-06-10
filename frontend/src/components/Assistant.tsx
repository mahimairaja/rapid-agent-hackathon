import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, SessionContext, SourceItem } from '../types'
import { VoiceClient, type TranscriptRole, type VoiceState } from '../lib/ws'
import { useAudioAnalyser } from '../lib/useAudioAnalyser'
import { getSessionContext } from '../api/client'
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

const GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content:
    "👋 Hi, I'm your **Rapid Recovery** assistant. I can talk or chat. To pull up your plan, tell me your **name and date of birth**, or your **patient code** — say it or type it below.",
  timestamp: new Date(),
}

interface AssistantProps {
  // Fired whenever the live session's grounding context loads, so the rest of
  // the app (dashboard, medications, appointments) can hydrate from the
  // conversation once the patient is identified.
  onContext?: (ctx: SessionContext) => void
}

export function Assistant({ onContext }: AssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [liveUser, setLiveUser] = useState('')
  const [liveAssistant, setLiveAssistant] = useState('')
  const [input, setInput] = useState('')
  const [state, setState] = useState<VoiceState>('connecting')
  const [error, setError] = useState('')
  const [micActive, setMicActive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [context, setContext] = useState<SessionContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [highlights, setHighlights] = useState<SourceItem[]>([])

  const clientRef = useRef<VoiceClient | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const liveUserRef = useRef('')
  const liveAssistantRef = useRef('')
  const pendingSourcesRef = useRef<SourceItem[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  // The connection effect runs once; keep the latest onContext reachable from it.
  const onContextRef = useRef(onContext)
  useEffect(() => {
    onContextRef.current = onContext
  }, [onContext])

  const levels = useAudioAnalyser(clientRef, state)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveUser, liveAssistant])

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

    const loadContext = async () => {
      const sid = sessionIdRef.current
      if (!sid) return
      setContextLoading(true)
      const ctx = await getSessionContext(sid)
      if (cancelled) return
      setContext(ctx)
      setContextLoading(false)
      onContextRef.current?.(ctx)
    }

    const client = new VoiceClient({
      onState: (s) => {
        if (!cancelled) setState(s)
      },
      onError: (msg) => {
        if (!cancelled) setError(msg)
      },
      onSession: (sid) => {
        sessionIdRef.current = sid
      },
      onTranscript: (text: string, final: boolean, role: TranscriptRole) => {
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
        pendingSourcesRef.current = items.filter((i) => i.type !== 'identity')
        if (items.some((i) => i.type === 'identity' || i.type === 'appointment')) {
          void loadContext()
        }
      },
    })
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
    clientRef.current?.sendText(t)
    setInput('')
  }

  const toggleMic = async () => {
    const client = clientRef.current
    if (!client) return
    setError('')
    if (client.isMicActive()) {
      client.stopMic()
    } else {
      await client.startMic()
    }
    setMicActive(client.isMicActive())
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
    setError('')
    setMicActive(false)
    // Full teardown then a fresh connect: the transcript lives in this
    // component, so only the underlying conversation session is replaced.
    await client.disconnect()
    await client.connect()
    if (context?.verified) {
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

  const hasUserTurn = messages.some((m) => m.role === 'user')
  const chips = hasUserTurn ? FOLLOW_UPS : SUGGESTED_FIRST
  const live = state === 'listening' || state === 'speaking'
  const offline = state === 'idle' || state === 'error'

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
              ↻ Reconnect
            </button>
          )}
        </div>

        <div className="assistant-transcript" aria-label="Conversation">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className={`chat-avatar ${msg.role}`}>
                {msg.role === 'assistant' ? '🤖' : '🙂'}
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
                        <span key={i} className="source-chip" title={s.snippet ?? undefined}>
                          {label}
                        </span>
                      ) : null
                    })}
                  </div>
                )}
                <div className="chat-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}

          {liveUser && (
            <div className="chat-message user">
              <div className="chat-avatar user">🙂</div>
              <div>
                <div className="chat-bubble" style={{ opacity: 0.65 }}>
                  {liveUser}
                </div>
              </div>
            </div>
          )}
          {liveAssistant && (
            <div className="chat-message assistant">
              <div className="chat-avatar assistant">🤖</div>
              <div>
                <div
                  className="chat-bubble chat-bubble-md"
                  style={{ opacity: 0.65 }}
                  dangerouslySetInnerHTML={{ __html: renderText(liveAssistant) }}
                />
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
            {micActive ? '■' : '🎤'}
          </button>

          <AudioVisualizer levels={levels} state={state} />

          <input
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
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <GroundingPanel context={context} highlights={highlights} loading={contextLoading} />
    </div>
  )
}
