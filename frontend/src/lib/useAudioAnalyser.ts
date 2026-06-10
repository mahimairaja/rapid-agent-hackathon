import { useEffect, useRef, useState, type RefObject } from 'react'
import type { VoiceClient, VoiceState } from './ws'

const BARS = 28
const BASELINE = 0.05

/**
 * Sample the live client's mic input (while listening) or agent output (while
 * speaking) and return a smoothed bar spectrum for the waveform visualizer.
 *
 * Takes the client *ref* (not its current value) and reads the `AnalyserNode`s
 * inside the animation frame, so it survives the mic graph being rebuilt and
 * never touches a ref during render. When no audio is flowing the bars decay to
 * a calm baseline and the loop parks itself.
 */
export function useAudioAnalyser(
  clientRef: RefObject<VoiceClient | null>,
  state: VoiceState,
): number[] {
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(BASELINE))
  const smoothed = useRef<number[]>(new Array(BARS).fill(BASELINE))

  useEffect(() => {
    const active = state === 'listening' || state === 'speaking'
    const buf = new Uint8Array(128)
    let raf = 0
    let stopped = false

    const tick = () => {
      if (stopped) return
      const client = clientRef.current
      const analyser = active
        ? state === 'speaking'
          ? client?.outputAnalyser
          : client?.inputAnalyser
        : null
      const next = smoothed.current.slice()
      let moving = false
      if (analyser) {
        analyser.getByteFrequencyData(buf)
        const step = Math.floor(buf.length / BARS) || 1
        for (let i = 0; i < BARS; i++) {
          const target = Math.min(1, buf[i * step] / 200)
          next[i] = next[i] * 0.7 + target * 0.3
        }
        moving = true
      } else {
        for (let i = 0; i < BARS; i++) {
          next[i] = next[i] * 0.85 + BASELINE * 0.15
          if (Math.abs(next[i] - BASELINE) > 0.005) moving = true
        }
      }
      smoothed.current = next
      setLevels(next.slice())
      if (active || moving) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [clientRef, state])

  return levels
}
