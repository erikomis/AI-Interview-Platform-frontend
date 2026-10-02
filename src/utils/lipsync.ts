/** Word timing from the server's TTS (milliseconds from the start of the audio). */
export interface WordTiming {
  w: string
  s: number
  d: number
}

/** One mouth shape on the timeline (seconds). */
export interface VisemeKey {
  v: Viseme
  t0: number
  t1: number
}

export type Viseme =
  | 'aa' | 'E' | 'I' | 'O' | 'U'
  | 'PP' | 'FF' | 'TH' | 'DD' | 'kk' | 'CH' | 'SS' | 'nn' | 'RR'

const VOWELS = new Set<Viseme>(['aa', 'E', 'I', 'O', 'U'])

const ACCENTS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', ê: 'e', è: 'e', ë: 'e',
  í: 'i', î: 'i', ì: 'i', ï: 'i',
  ó: 'o', ô: 'o', õ: 'o', ò: 'o', ö: 'o',
  ú: 'u', û: 'u', ù: 'u', ü: 'u',
}

/**
 * Rough grapheme → viseme conversion for Portuguese and English. It is not a
 * phonetic transcription, but at speaking speed the mouth only needs to hit
 * the right family of shapes (open, rounded, spread, closed lips, teeth on lip).
 */
export function wordToVisemes(word: string, lang: 'pt' | 'en'): Viseme[] {
  const w = word
    .toLowerCase()
    .replace(/[áàâãäéêèëíîìïóôõòöúûùü]/g, (c) => ACCENTS[c] ?? c)
    .replace(/[^a-zç]/g, '')
  const out: Viseme[] = []
  for (let i = 0; i < w.length; i++) {
    const c = w[i]
    const n = w[i + 1] ?? ''
    const two = c + n
    if (two === 'ch' || two === 'sh') { out.push('CH'); i++; continue }
    if (two === 'lh' || two === 'nh') { out.push('nn'); i++; continue }
    if (two === 'th' && lang === 'en') { out.push('TH'); i++; continue }
    if (two === 'qu' || two === 'gu') { out.push('kk'); i++; continue }
    if (two === 'rr' || two === 'ss') { out.push(two === 'rr' ? 'RR' : 'SS'); i++; continue }
    switch (c) {
      case 'a': out.push('aa'); break
      case 'e': out.push('E'); break
      case 'i': case 'y': out.push('I'); break
      case 'o': out.push('O'); break
      case 'u': case 'w': out.push('U'); break
      case 'p': case 'b': case 'm': out.push('PP'); break
      case 'f': case 'v': out.push('FF'); break
      case 't': case 'd': out.push('DD'); break
      case 'n': case 'l': out.push('nn'); break
      case 'r': out.push('RR'); break
      case 's': case 'z': case 'ç': out.push('SS'); break
      case 'x': out.push(lang === 'pt' ? 'CH' : 'kk'); break
      case 'j': out.push('CH'); break
      case 'c': out.push(n === 'e' || n === 'i' ? 'SS' : 'kk'); break
      case 'g': out.push(lang === 'pt' && (n === 'e' || n === 'i') ? 'CH' : 'kk'); break
      case 'k': case 'q': out.push('kk'); break
      case 'h': break // silent in Portuguese, breathy in English — no distinct shape
      default: break
    }
  }
  // Collapse repeats so the mouth doesn't flutter on double letters
  return out.filter((v, i) => v !== out[i - 1])
}

/** Spreads each word's visemes over its spoken duration (vowels take longer). */
export function buildVisemeTrack(words: WordTiming[], lang: 'pt' | 'en'): VisemeKey[] {
  const track: VisemeKey[] = []
  for (const { w, s, d } of words) {
    const visemes = wordToVisemes(w, lang)
    if (!visemes.length || d <= 0) continue
    const weights = visemes.map((v) => (VOWELS.has(v) ? 1.4 : 0.8))
    const total = weights.reduce((a, b) => a + b, 0)
    let t = s / 1000
    const dur = d / 1000
    visemes.forEach((v, i) => {
      const len = (weights[i] / total) * dur
      track.push({ v, t0: t, t1: t + len })
      t += len
    })
  }
  return track
}
