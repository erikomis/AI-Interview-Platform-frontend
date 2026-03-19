let _audioCtx: AudioContext | null = null
let _analyser: AnalyserNode | null = null

function ensureAudioContext(): { ctx: AudioContext; analyser: AnalyserNode } {
  if (!_audioCtx) {
    _audioCtx = new AudioContext()
    _analyser = _audioCtx.createAnalyser()
    _analyser.fftSize = 512
    _analyser.smoothingTimeConstant = 0.75
    _analyser.connect(_audioCtx.destination)
  }
  return { ctx: _audioCtx!, analyser: _analyser! }
}

export const getAnalyser = (): AnalyserNode | null => _analyser

function detectAudioMime(base64: string): string {
  try {
    const bin = atob(base64.slice(0, 16))
    const b = (i: number) => bin.charCodeAt(i)
    if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46) return 'audio/wav'
    if (b(0) === 0x49 && b(1) === 0x44 && b(2) === 0x33) return 'audio/mpeg'
    if ((b(0) === 0xFF && (b(1) & 0xE0) === 0xE0)) return 'audio/mpeg'
  } catch { /* fallthrough */ }
  return 'audio/mpeg'
}

export const playAudio = (base64: string): Promise<void> => {
  return new Promise((resolve) => {
    const mime = detectAudioMime(base64)
    const audio = new Audio(`data:${mime};base64,${base64}`)
    try {
      const { ctx, analyser } = ensureAudioContext()
      if (ctx.state === 'suspended') ctx.resume()
      const source = ctx.createMediaElementSource(audio)
      source.connect(analyser)
    } catch {
      // play without analysis on error
    }
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
    audio.play().catch(() => resolve())
  })
}

function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  // Priority: Microsoft/Edge pt-BR > any pt-BR (non-Google) > any pt-BR > any pt
  return (
    voices.find((v) => v.lang === 'pt-BR' && v.name.toLowerCase().includes('microsoft')) ||
    voices.find((v) => v.lang === 'pt-BR' && !v.name.toLowerCase().includes('google')) ||
    voices.find((v) => v.lang === 'pt-BR') ||
    voices.find((v) => v.lang.startsWith('pt')) ||
    null
  )
}

export const speakText = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return }
    window.speechSynthesis.cancel()

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 0.88
      utterance.pitch = 1.05
      utterance.volume = 1.0
      const voice = getBestVoice()
      if (voice) utterance.voice = voice
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    }

    // Chrome loads voices asynchronously — wait if not ready yet
    if (window.speechSynthesis.getVoices().length > 0) {
      speak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null
        speak()
      }
    }
  })
}

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
