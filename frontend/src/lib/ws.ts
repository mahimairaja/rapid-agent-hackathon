import { getVoiceWsUrl } from '../api/client'
import type { SourceItem } from '../types'

export type VoiceState = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'

export type TranscriptRole = 'user' | 'assistant'

export interface VoiceHandlers {
  onState?: (state: VoiceState) => void
  onTranscript?: (text: string, final: boolean, role: TranscriptRole) => void
  onError?: (message: string) => void
  onSession?: (sessionId: string) => void
  onSources?: (items: SourceItem[]) => void
  onTool?: (tool: string, status: 'running' | 'done') => void
  onTurnComplete?: () => void
  onInterrupted?: () => void
  onIdentifyFailed?: () => void
}

const INPUT_RATE = 16000
const OUTPUT_RATE = 24000

interface ControlFrame {
  type: string
  text?: string
  final?: boolean
  role?: TranscriptRole
  session_id?: string
  items?: SourceItem[]
  tool?: string
  status?: string
}

/**
 * One Gemini Live session driving both chat and voice over a single WebSocket.
 *
 * The socket is opened by `connect()` so typed text works without a microphone;
 * `startMic()`/`stopMic()` add or remove live audio capture without dropping the
 * session. Spoken replies play through a gain node (so `setMuted` silences audio
 * while the transcript keeps flowing), and barge-in flushes playback on an
 * `interrupted` control frame. Input/output `AnalyserNode`s are exposed for the
 * waveform visualizer.
 */
export class VoiceClient {
  private handlers: VoiceHandlers
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private micSink: GainNode | null = null
  private playbackGain: GainNode | null = null
  private playHead = 0
  private scheduled: AudioBufferSourceNode[] = []
  private micActive = false
  private muted = false
  // Onboarded accounts: sent as a deterministic identify frame as soon as each
  // new session opens (first connect AND reconnects), so the session is
  // verified without a chat round trip.
  private identifyCode: string | null = null
  // Messages typed while the socket is closed or still connecting. Flushed
  // after each new session opens (post-identify), so nothing typed during a
  // reconnect is silently dropped.
  private pendingTexts: string[] = []
  // True once any session has opened on this client: later sessions are
  // reconnects, and the backend greets differently for those.
  private hadSession = false

  // Exposed for the visualizer (read-only use).
  inputAnalyser: AnalyserNode | null = null
  outputAnalyser: AnalyserNode | null = null

  constructor(handlers: VoiceHandlers = {}) {
    this.handlers = handlers
  }

  setIdentifyCode(code: string | null): void {
    this.identifyCode = code
  }

  /** Open the audio graph and the WebSocket. No microphone is requested. */
  async connect(): Promise<void> {
    if (this.ws) return
    this.setState('connecting')
    try {
      this.ctx = new AudioContext()
      this.playbackGain = this.ctx.createGain()
      this.playbackGain.gain.value = this.muted ? 0 : 1
      this.outputAnalyser = this.ctx.createAnalyser()
      this.outputAnalyser.fftSize = 256
      // Playback chain: sources -> gain -> (analyser tap) -> destination.
      this.playbackGain.connect(this.outputAnalyser)
      this.playbackGain.connect(this.ctx.destination)

      this.ws = new WebSocket(getVoiceWsUrl())
      this.ws.binaryType = 'arraybuffer'
      this.ws.onopen = () => this.setState(this.micActive ? 'listening' : 'connected')
      this.ws.onmessage = (event) => this.onMessage(event)
      this.ws.onerror = () => {
        this.handlers.onError?.('Voice connection error.')
        this.setState('error')
      }
      this.ws.onclose = () => this.setState('idle')
    } catch (err) {
      this.handlers.onError?.(err instanceof Error ? err.message : 'Could not connect.')
      this.setState('error')
      await this.disconnect()
    }
  }

  /** Begin microphone capture, streaming 16 kHz PCM16 frames to the session. */
  async startMic(): Promise<void> {
    if (this.micActive || !this.ctx) return
    try {
      await this.ctx.resume()
      await this.ctx.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}worklets/capture-processor.js`,
      )
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      this.source = this.ctx.createMediaStreamSource(this.micStream)
      this.worklet = new AudioWorkletNode(this.ctx, 'capture-processor', {
        processorOptions: { targetRate: INPUT_RATE },
      })
      this.worklet.port.onmessage = (event) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(event.data as ArrayBuffer)
        }
      }
      this.inputAnalyser = this.ctx.createAnalyser()
      this.inputAnalyser.fftSize = 256
      this.source.connect(this.inputAnalyser)
      // A muted sink keeps the capture graph pulling without monitoring the mic.
      this.micSink = this.ctx.createGain()
      this.micSink.gain.value = 0
      this.source.connect(this.worklet)
      this.worklet.connect(this.micSink)
      this.micSink.connect(this.ctx.destination)
      this.micActive = true
      this.setState('listening')
    } catch (err) {
      this.handlers.onError?.(
        err instanceof Error ? err.message : 'Could not access the microphone.',
      )
      this.stopMic()
    }
  }

  /** Stop microphone capture but keep the session open for typed turns. */
  stopMic(): void {
    try {
      this.worklet?.disconnect()
      this.source?.disconnect()
      this.micSink?.disconnect()
      this.inputAnalyser?.disconnect()
    } catch {
      /* ignore */
    }
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = null
    this.worklet = null
    this.source = null
    this.micSink = null
    this.inputAnalyser = null
    this.micActive = false
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setState('connected')
    }
  }

  isMicActive(): boolean {
    return this.micActive
  }

  /** Send a typed message into the same live session.

   *  A message sent while the socket is closed or connecting is queued and
   *  delivered once the next session opens (the caller is responsible for
   *  triggering the reconnect). */
  sendText(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingTexts.push(trimmed)
      return
    }
    void this.ctx?.resume()
    this.ws.send(JSON.stringify({ type: 'text', text: trimmed }))
  }

  /** Hide spoken audio (keep the transcript) or restore it. */
  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.playbackGain) this.playbackGain.gain.value = muted ? 0 : 1
    if (muted) this.flushPlayback()
  }

  isMuted(): boolean {
    return this.muted
  }

  private onMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
      let msg: ControlFrame
      try {
        msg = JSON.parse(event.data) as ControlFrame
      } catch {
        return
      }
      switch (msg.type) {
        case 'session':
          if (msg.session_id) {
            // Identify before surfacing the session id, so the verified state
            // is already being written when context fetches start.
            if (this.identifyCode && this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: 'identify',
                  patient_code: this.identifyCode,
                  reconnect: this.hadSession,
                }),
              )
            }
            this.hadSession = true
            // Deliver anything typed while disconnected, after identify so the
            // verification gate is already satisfied for onboarded accounts.
            if (this.ws?.readyState === WebSocket.OPEN && this.pendingTexts.length) {
              for (const text of this.pendingTexts) {
                this.ws.send(JSON.stringify({ type: 'text', text }))
              }
              this.pendingTexts = []
            }
            this.handlers.onSession?.(msg.session_id)
          }
          break
        case 'identify_failed':
          this.handlers.onIdentifyFailed?.()
          break
        case 'transcript':
          if (msg.text) {
            this.handlers.onTranscript?.(
              msg.text,
              Boolean(msg.final),
              msg.role === 'user' ? 'user' : 'assistant',
            )
          }
          break
        case 'sources':
          if (msg.items?.length) this.handlers.onSources?.(msg.items)
          break
        case 'tool':
          if (msg.tool) {
            this.handlers.onTool?.(msg.tool, msg.status === 'done' ? 'done' : 'running')
          }
          break
        case 'interrupted':
          this.flushPlayback()
          this.handlers.onInterrupted?.()
          break
        case 'turn_complete':
          this.handlers.onTurnComplete?.()
          this.setState(this.micActive ? 'listening' : 'connected')
          break
        case 'error':
          this.handlers.onError?.('The assistant had a problem. Please try again.')
          break
      }
      return
    }
    this.enqueueAudio(event.data as ArrayBuffer)
  }

  private enqueueAudio(buffer: ArrayBuffer): void {
    if (!this.ctx || !this.playbackGain) return
    // While muted, drop spoken audio entirely: no playback, no "speaking" state,
    // and playHead does not advance, so unmuting resumes cleanly. The transcript
    // keeps flowing independently.
    if (this.muted) return
    this.setState('speaking')
    const pcm = new Int16Array(buffer)
    const samples = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 0x8000
    const audioBuffer = this.ctx.createBuffer(1, samples.length, OUTPUT_RATE)
    audioBuffer.copyToChannel(samples, 0)
    const node = this.ctx.createBufferSource()
    node.buffer = audioBuffer
    node.connect(this.playbackGain)
    const startAt = Math.max(this.ctx.currentTime, this.playHead)
    node.start(startAt)
    this.playHead = startAt + audioBuffer.duration
    this.scheduled.push(node)
    node.onended = () => {
      this.scheduled = this.scheduled.filter((n) => n !== node)
      if (this.scheduled.length === 0) {
        this.setState(this.micActive ? 'listening' : 'connected')
      }
    }
  }

  private flushPlayback(): void {
    for (const node of this.scheduled) {
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
    }
    this.scheduled = []
    this.playHead = this.ctx ? this.ctx.currentTime : 0
  }

  /** Full teardown: microphone, socket, and audio context. */
  async disconnect(): Promise<void> {
    this.flushPlayback()
    this.stopMic()
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    try {
      this.playbackGain?.disconnect()
      this.outputAnalyser?.disconnect()
    } catch {
      /* ignore */
    }
    this.playbackGain = null
    this.outputAnalyser = null
    if (this.ctx) {
      try {
        await this.ctx.close()
      } catch {
        /* ignore */
      }
      this.ctx = null
    }
    this.setState('idle')
  }

  private setState(state: VoiceState): void {
    this.handlers.onState?.(state)
  }
}
