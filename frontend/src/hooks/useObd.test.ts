import { expect, test } from 'vitest'
import { parseObdBytes } from './useObd'

test('interpreta respuestas ELM327 con espacios y saltos de línea', () => {
  expect(parseObdBytes('41 0C 1A F8\r\n>', '410C')).toEqual([0x1a, 0xf8])
  expect(parseObdBytes('SEARCHING...\r41 0D 3C\r>', '410D')).toEqual([0x3c])
  expect(parseObdBytes('NO DATA\r>', '4105')).toBeNull()
})
