/**
 * Web Speech API hooks — voice-to-voice interviewing with zero backend cost.
 *
 * The whole feature rides on two browser primitives:
 *   - speechSynthesis      the interviewer's question, spoken aloud (TTS)
 *   - SpeechRecognition    the candidate's answer, transcribed to text (STT)
 *
 * That choice is deliberate. The existing turn endpoint already takes text and
 * returns text; voice only has to feed text in and read text out. So the entire
 * feature is client-side — no server round trip for audio, no API keys, no
 * cost, and it works offline. It also keeps a hard rule intact: the interview
 * *logic* never learns that voice exists.
 *
 * Both hooks feature-detect and degrade to nothing. STT is a Chromium feature
 * (Chrome/Edge); TTS is near-universal. Anything unsupported simply reports
 * `supported: false` and the UI hides the affordance.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ types */
/* The Web Speech STT interfaces are not in the standard DOM lib, so declare
 * the minimum surface we use rather than pulling `any` through the code. */

interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ===================================================================== TTS */

export interface SpeechSynthesisController {
  supported: boolean
  speaking: boolean
  /** Speak text. Cancels anything already in progress first. */
  speak: (text: string) => void
  cancel: () => void
}

/**
 * Prefer a natural-sounding English voice. Edge ships genuinely good neural
 * voices (Aria, Jenny, Guy); Chrome has "Google US English". Fall back to any
 * en voice, then the platform default.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  const pool = en.length ? en : voices
  const preferred = [
    /aria/i, /jenny/i, /natural/i, /google us english/i, /google uk/i,
    /guy/i, /libby/i, /samantha/i,
  ]
  for (const re of preferred) {
    const hit = pool.find((v) => re.test(v.name))
    if (hit) return hit
  }
  return pool.find((v) => v.lang.toLowerCase() === 'en-us') ?? pool[0]
}

/** Split into sentence-ish chunks. Chrome silently stops speaking a single
 *  utterance after ~15 seconds; queuing shorter utterances sidesteps that and
 *  also lets `cancel()` interrupt promptly. */
function chunk(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const parts = cleaned.match(/[^.!?]+[.!?]*(\s|$)/g)
  if (!parts) return [cleaned]
  // Merge tiny fragments into the previous chunk so we don't over-segment.
  const out: string[] = []
  for (const p of parts) {
    const t = p.trim()
    if (!t) continue
    if (out.length && (out[out.length - 1].length < 24 || t.length < 24)) {
      out[out.length - 1] += ' ' + t
    } else {
      out.push(t)
    }
  }
  return out
}

export function useSpeechSynthesis(): SpeechSynthesisController {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  // A generation counter: bumping it invalidates the queue of a prior speak()
  // whose utterances are still firing their onend handlers.
  const genRef = useRef(0)

  useEffect(() => {
    if (!supported) return
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    genRef.current += 1
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const gen = (genRef.current += 1)
      const voice = pickVoice(voicesRef.current)
      const chunks = chunk(text)
      if (!chunks.length) return

      setSpeaking(true)
      chunks.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part)
        if (voice) u.voice = voice
        // A calm, considered interviewer — a hair slower than default, natural
        // pitch. Not a hyperactive assistant.
        u.rate = 0.98
        u.pitch = 1.0
        u.onend = () => {
          if (gen !== genRef.current) return // superseded by a newer speak/cancel
          if (i === chunks.length - 1) setSpeaking(false)
        }
        u.onerror = () => {
          if (gen === genRef.current && i === chunks.length - 1) setSpeaking(false)
        }
        window.speechSynthesis.speak(u)
      })
    },
    [supported],
  )

  return { supported, speaking, speak, cancel }
}

/* ===================================================================== STT */

export interface SpeechRecognitionController {
  supported: boolean
  listening: boolean
  /** Text finalised so far in the current listening session. */
  transcript: string
  /** The in-progress phrase, not yet finalised. */
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(): SpeechRecognitionController {
  const ctorRef = useRef<SpeechRecognitionCtor | null>(getRecognitionCtor())
  const supported = ctorRef.current !== null

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Guards the auto-restart: continuous recognition fires `onend` on its own
  // (silence timeouts, etc.); while the user still wants to talk we restart it,
  // and only truly stop when they press the button.
  const wantListeningRef = useRef(false)

  const stop = useCallback(() => {
    wantListeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  const start = useCallback(() => {
    if (!supported || !ctorRef.current) return
    setError(null)
    setInterim('')

    const recognition = new ctorRef.current()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text
        else interimChunk += text
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? prev + ' ' : '') + finalChunk.trim())
      }
      setInterim(interimChunk)
    }

    recognition.onerror = (event) => {
      // `no-speech` and `aborted` are normal lifecycle noise, not real errors.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone access was blocked. Allow it in your browser to answer by voice.'
            : `Voice input error: ${event.error}`,
        )
        wantListeningRef.current = false
      }
    }

    recognition.onend = () => {
      // Restart if the user still wants to talk; the API ends sessions on its
      // own after pauses.
      if (wantListeningRef.current) {
        try {
          recognition.start()
          return
        } catch {
          /* already starting — ignore */
        }
      }
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    wantListeningRef.current = true
    try {
      recognition.start()
    } catch {
      /* start() throws if called while already active — safe to ignore */
    }
  }, [supported])

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      recognitionRef.current?.abort()
    }
  }, [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
