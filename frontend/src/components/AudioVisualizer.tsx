import type { VoiceState } from '../lib/ws'

interface AudioVisualizerProps {
  levels: number[]
  state: VoiceState
}

const STATE_COLOR: Partial<Record<VoiceState, string>> = {
  listening: 'var(--blue-500, #2563eb)',
  speaking: 'var(--teal-500, #0d9488)',
  connected: 'var(--gray-400, #9ca3af)',
  connecting: 'var(--gray-300, #cbd5e1)',
  error: 'var(--red-500, #ef4444)',
}

/**
 * A LiveKit/Pipecat-style bar spectrum. Symmetric bars grow from the center and
 * tint by state (listening = blue, speaking = teal). Purely presentational; the
 * levels come from `useAudioAnalyser`.
 */
export function AudioVisualizer({ levels, state }: AudioVisualizerProps) {
  const color = STATE_COLOR[state] ?? 'var(--gray-400, #9ca3af)'
  return (
    <div
      aria-hidden="true"
      className="audio-viz"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: 36,
        flex: 1,
        minWidth: 80,
      }}
    >
      {levels.map((level, i) => {
        const height = Math.max(3, Math.round(level * 34))
        return (
          <span
            key={i}
            style={{
              width: 3,
              height,
              borderRadius: 3,
              background: color,
              opacity: 0.35 + level * 0.65,
              transition: 'height 80ms linear, opacity 80ms linear',
            }}
          />
        )
      })}
    </div>
  )
}
