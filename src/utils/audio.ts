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

function speechLang(language: string): string {
  return language.startsWith('en') ? 'en-US' : 'pt-BR'
}

function getBestVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const base = lang.split('-')[0]
  // Priority: Microsoft/Edge <lang> > any <lang> (non-Google) > any <lang> > any same base language
  return (
    voices.find((v) => v.lang === lang && v.name.toLowerCase().includes('microsoft')) ||
    voices.find((v) => v.lang === lang && !v.name.toLowerCase().includes('google')) ||
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(base)) ||
    null
  )
}

const VOICES_TIMEOUT_MS = 1500

/** Resolves once voices are available (or after a timeout — Safari/Firefox may never fire voiceschanged). */
function waitForVoices(): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (synth.getVoices().length > 0) { resolve(); return }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      synth.removeEventListener('voiceschanged', finish)
      resolve()
    }
    const timer = setTimeout(finish, VOICES_TIMEOUT_MS)
    synth.addEventListener('voiceschanged', finish)
  })
}

/** Speaks text with the browser TTS. `language` is the interview language ("pt" | "en"). */
export const speakText = async (text: string, language = 'pt'): Promise<void> => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  await waitForVoices()

  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    synth.cancel()

    const lang = speechLang(language)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.88
    utterance.pitch = 1.05
    utterance.volume = 1.0
    const voice = getBestVoice(lang)
    if (voice) utterance.voice = voice

    // Safety net: some browsers never fire onend (e.g. cancelled or blocked speech)
    const maxMs = Math.max(10_000, text.length * 150)
    const timer = setTimeout(() => resolve(), maxMs)
    const done = () => { clearTimeout(timer); resolve() }
    utterance.onend = done
    utterance.onerror = done
    synth.speak(utterance)
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
