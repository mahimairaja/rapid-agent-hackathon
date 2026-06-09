import { useEffect, useRef, useState } from 'react'
import { VoiceClient, type VoiceState } from '../lib/ws'

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Tap to talk',
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Homeward is speaking…',
  error: 'Something went wrong',
}

export function VoiceConsole() {
  const [state, setState] = useState<VoiceState>('idle')
  const [live, setLive] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const clientRef = useRef<VoiceClient | null>(null)

  useEffect(() => {
    return () => {
      void clientRef.current?.stop()
    }
  }, [])

  const start = async () => {
    // Stop any existing client first so a double-start cannot leak a mic/socket
    // or run two concurrent sessions.
    if (clientRef.current) {
      await clientRef.current.stop()
      clientRef.current = null
    }
    setError('')
    setLog([])
    setLive('')
    const client = new VoiceClient({
      onState: setState,
      onTranscript: (text, final) => {
        if (final) {
          setLog((prev) => [...prev, text])
          setLive('')
        } else {
          setLive(text)
        }
      },
      onError: setError,
    })
    clientRef.current = client
    await client.start()
  }

  const stop = async () => {
    await clientRef.current?.stop()
    clientRef.current = null
    setState('idle')
  }

  const active = state !== 'idle' && state !== 'error'

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <div>
          <div className="card-title">🎙️ Voice Conversation</div>
          <div className="card-subtitle">
            Speak naturally and interrupt any time. Powered by Gemini Live.
          </div>
        </div>
        <span className={`badge ${active ? 'badge-green live-dot' : 'badge-blue'}`}>
          {active ? 'Live' : 'Idle'}
        </span>
      </div>

      <div
        className="card-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={active ? stop : start}
          aria-label={active ? 'Stop voice conversation' : 'Start voice conversation'}
          aria-pressed={active}
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            fontSize: 30,
            background: active
              ? 'linear-gradient(135deg, var(--red-400), var(--amber-400))'
              : 'linear-gradient(135deg, var(--blue-500, #2563eb), #4f46e5)',
            boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)',
          }}
        >
          {active ? '■' : '🎤'}
        </button>
        <div aria-live="polite" style={{ fontWeight: 600 }}>
          {STATE_LABEL[state]}
        </div>

        {(log.length > 0 || live) && (
          <div
            aria-label="Transcript"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: 220,
              overflowY: 'auto',
              padding: 12,
              borderRadius: 12,
              background: 'var(--gray-50, #f8fafc)',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {log.map((line, i) => (
              <p key={i} style={{ margin: '0 0 8px' }}>
                {line}
              </p>
            ))}
            {live && <p style={{ margin: 0, opacity: 0.6 }}>{live}</p>}
          </div>
        )}

        {error && (
          <div role="alert" style={{ color: 'var(--red-500, #ef4444)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <p style={{ fontSize: 12, opacity: 0.6, margin: 0, textAlign: 'center' }}>
          Your microphone is only used while a voice conversation is active.
        </p>
      </div>
    </div>
  )
}
