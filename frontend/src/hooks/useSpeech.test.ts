import { afterEach, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { selectNavigationVoice, useSpeech } from './useSpeech'

afterEach(() => vi.unstubAllGlobals())

test('prefiere una voz natural española si está disponible', () => {
  const voices = [
    { name: 'English Natural', lang: 'en-US', default: true },
    { name: 'Español', lang: 'es-ES' },
    { name: 'Google español', lang: 'es-ES' },
  ] as SpeechSynthesisVoice[]
  expect(selectNavigationVoice(voices, 'es-ES')?.name).toBe('Google español')
  expect(selectNavigationVoice([], 'es-ES')).toBeUndefined()
})

test('no encola localidades durante un giro y permite detener los avisos', () => {
  const synthesis = { speaking: true, pending: false, cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] }
  vi.stubGlobal('speechSynthesis', synthesis)
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
  const { result } = renderHook(() => useSpeech())
  act(() => { expect(result.current.speak('Circulas por San Roque', false)).toBe(false) })
  expect(synthesis.speak).not.toHaveBeenCalled()
  act(() => { expect(result.current.speak('Ahora, gira a la derecha')).toBe(true) })
  expect(synthesis.cancel).toHaveBeenCalledTimes(1)
  expect(synthesis.speak).toHaveBeenCalledTimes(1)
  act(() => result.current.stopSpeaking())
  expect(synthesis.cancel).toHaveBeenCalledTimes(2)
})

