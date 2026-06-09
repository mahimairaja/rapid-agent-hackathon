import { getVoiceWsUrl } from '../api/client'

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export interface VoiceHandlers {
  onState?: (state: VoiceState) => void
  onTranscript?: (text: string, final: boolean) => void
  onError?: (message: string) => void
}

const INPUT_RATE = 16000
const OUTPUT_RATE = 24000

/**
 * Manages a voice turn: mic capture (AudioWorklet -> 16 kHz PCM16 frames over a
 * WebSocket) and playback of the 24 kHz PCM16 response with barge-in (on an
 * `interrupted` control message the queued playback is flushed immediately).
 */
export class VoiceClient {
  private handlers: VoiceHandlers
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private playHead = 0
  private scheduled: AudioBufferSourceNode[] = []

  constructor(handlers: VoiceHandlers = {}) {
    this.handlers = handlers
  }

  async start(): Promise<void> {
    this.setState('connecting')
    try {
      this.ctx = new AudioContext()
      // Served from /public so the module URL is stable in dev and production.
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
      // A muted sink keeps the capture graph pulling without monitoring the mic.
      this.sink = this.ctx.createGain()
      this.sink.gain.value = 0
      this.source.connect(this.worklet)
      this.worklet.connect(this.sink)
      this.sink.connect(this.ctx.destination)

      this.ws = new WebSocket(getVoiceWsUrl())
      this.ws.binaryType = 'arraybuffer'
      this.ws.onopen = () => this.setState('listening')
      this.ws.onmessage = (event) => this.onMessage(event)
      this.ws.onerror = () => {
        this.handlers.onError?.('Voice connection error.')
        this.setState('error')
      }
      this.ws.onclose = () => this.setState('idle')
    } catch (err) {
      this.handlers.onError?.(err instanceof Error ? err.message : 'Could not start voice.')
      this.setState('error')
      await this.stop()
    }
  }

  private onMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data) as {
          type: string
          text?: string
          final?: boolean
        }
        if (msg.type === 'transcript' && msg.text) {
          this.handlers.onTranscript?.(msg.text, Boolean(msg.final))
        } else if (msg.type === 'interrupted') {
          this.flushPlayback()
        } else if (msg.type === 'turn_complete') {
          this.setState('listening')
        } else if (msg.type === 'error') {
          this.handlers.onError?.('The assistant had a problem. Please try again.')
        }
      } catch {
        /* ignore malformed control frame */
      }
      return
    }
    this.enqueueAudio(event.data as ArrayBuffer)
  }

  private enqueueAudio(buffer: ArrayBuffer): void {
    if (!this.ctx) return
    this.setState('speaking')
    const pcm = new Int16Array(buffer)
    const samples = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 0x8000
    const audioBuffer = this.ctx.createBuffer(1, samples.length, OUTPUT_RATE)
    audioBuffer.copyToChannel(samples, 0)
    const node = this.ctx.createBufferSource()
    node.buffer = audioBuffer
    node.connect(this.ctx.destination)
    const startAt = Math.max(this.ctx.currentTime, this.playHead)
    node.start(startAt)
    this.playHead = startAt + audioBuffer.duration
    this.scheduled.push(node)
    node.onended = () => {
      this.scheduled = this.scheduled.filter((n) => n !== node)
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
    this.setState('listening')
  }

  async stop(): Promise<void> {
    this.flushPlayback()
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    try {
      this.worklet?.disconnect()
      this.source?.disconnect()
      this.sink?.disconnect()
    } catch {
      /* ignore */
    }
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = null
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
