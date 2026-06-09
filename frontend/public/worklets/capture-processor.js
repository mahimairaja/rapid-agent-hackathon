/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// AudioWorklet capture processor (F6): takes mono microphone audio at the
// context sample rate and posts Int16 PCM downsampled to the target rate
// (default 16 kHz) expected by the Gemini Live input. Runs off the main thread.
// Served from /public so it loads at a stable URL in dev and production.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = (options && options.processorOptions) || {}
    this.targetRate = opts.targetRate || 16000
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const channel = input[0] // Float32Array at the global `sampleRate`
    const ratio = sampleRate / this.targetRate
    const outLength = Math.floor(channel.length / ratio)
    if (outLength <= 0) return true
    const out = new Int16Array(outLength)
    for (let i = 0; i < outLength; i++) {
      const sample = channel[Math.floor(i * ratio)]
      const clamped = Math.max(-1, Math.min(1, sample))
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    }
    this.port.postMessage(out.buffer, [out.buffer])
    return true
  }
}

registerProcessor('capture-processor', CaptureProcessor)
