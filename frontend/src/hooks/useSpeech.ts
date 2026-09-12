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

  const speak = useCallback(
    (text: string, interrupt = true) => {
      if (!synthesisSupported) return false
      if (interrupt) window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = language
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
    speak,
  }
}
