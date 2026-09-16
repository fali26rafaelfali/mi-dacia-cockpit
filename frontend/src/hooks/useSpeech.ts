import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<{ 0: { transcript: string; confidence: number } }>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

export function selectNavigationVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | undefined {
  const lang = language.toLowerCase()
  return voices.filter((voice) => voice.lang.toLowerCase().split('-')[0] === lang.split('-')[0])
    .sort((a, b) => {
      const score = (voice: SpeechSynthesisVoice) =>
        (/\b(pablo|jorge|diego|alvaro|álvaro|andres|andrés|carlos|male|masculin[oa])\b/i.test(voice.name) ? 1000 : 0) +
        (voice.lang.toLowerCase() === lang ? 100 : 0) +
        (/natural|neural|google/i.test(voice.name) ? 20 : 0) + (voice.default ? 1 : 0)
      return score(b) - score(a)
    })[0]
}

export function useSpeech(language = 'es-ES') {
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const speechWindow = typeof window === 'undefined' ? null : (window as SpeechWindow)
  const Recognition = speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition
  const recognitionSupported = Boolean(Recognition)
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopListening = useCallback(() => {
    recognition.current?.stop()
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!Recognition || recognition.current) return false
    const instance = new Recognition()
    instance.lang = language
    instance.continuous = false
    instance.interimResults = false
    instance.onresult = (event) => setTranscript(event.results[0]?.[0]?.transcript ?? '')
    instance.onerror = (event) => {
      setError(event.error ?? 'speech-recognition-error')
      setListening(false)
    }
    instance.onend = () => {
      recognition.current = null
      setListening(false)
    }
    recognition.current = instance
    setError(null)
    setListening(true)
    instance.start()
    return true
  }, [Recognition, language])

  const stopSpeaking = useCallback(() => {
    if (synthesisSupported) window.speechSynthesis.cancel()
  }, [synthesisSupported])

  const speak = useCallback(
    (text: string, interrupt = true) => {
      if (!synthesisSupported) return false
      // Los anuncios secundarios se descartan si hay una maniobra hablando.
      if (!interrupt && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) return false
      if (interrupt) window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = selectNavigationVoice(window.speechSynthesis.getVoices(), language)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? language
      utterance.rate = 0.98
      utterance.pitch = 1
      utterance.volume = 1
      window.speechSynthesis.speak(utterance)
      return true
    },
    [language, synthesisSupported],
  )

  useEffect(
    () => () => {
      recognition.current?.abort()
      recognition.current = null
      if (synthesisSupported) window.speechSynthesis.cancel()
    },
    [synthesisSupported],
  )

  return {
    recognitionSupported,
    synthesisSupported,
    listening,
    transcript,
    error,
    startListening,
    stopListening,
    stopSpeaking,
    speak,
  }
}
