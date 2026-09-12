import { useCallback, useEffect, useRef, useState } from 'react'

interface BleCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<BleCharacteristic>
  writeValue(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
}
interface BleService { getCharacteristic(uuid: string): Promise<BleCharacteristic> }
interface BleServer { connected: boolean; connect(): Promise<BleServer>; getPrimaryService(uuid: string): Promise<BleService>; disconnect(): void }
interface BleDevice extends EventTarget { name?: string; gatt?: BleServer }
interface BleApi { requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice> }

export interface ObdData {
  speedKph?: number
  rpm?: number
  coolantC?: number
  oilC?: number
  fuelPercent?: number
  engineLoadPercent?: number
  throttlePercent?: number
  intakeC?: number
  batteryVoltage?: number
}

const PROFILES = [
  { service: '0000fff0-0000-1000-8000-00805f9b34fb', notify: '0000fff1-0000-1000-8000-00805f9b34fb', write: '0000fff2-0000-1000-8000-00805f9b34fb' },
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', notify: '0000ffe1-0000-1000-8000-00805f9b34fb', write: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
]

const PIDS = [
  { cmd: '010D', header: '410D', apply: (bytes: number[], data: ObdData) => ({ ...data, speedKph: bytes[0] }) },
  { cmd: '010C', header: '410C', apply: (bytes: number[], data: ObdData) => ({ ...data, rpm: (bytes[0] * 256 + bytes[1]) / 4 }) },
  { cmd: '0105', header: '4105', apply: (bytes: number[], data: ObdData) => ({ ...data, coolantC: bytes[0] - 40 }) },
  { cmd: '012F', header: '412F', apply: (bytes: number[], data: ObdData) => ({ ...data, fuelPercent: bytes[0] * 100 / 255 }) },
  { cmd: '0104', header: '4104', apply: (bytes: number[], data: ObdData) => ({ ...data, engineLoadPercent: bytes[0] * 100 / 255 }) },
  { cmd: '0111', header: '4111', apply: (bytes: number[], data: ObdData) => ({ ...data, throttlePercent: bytes[0] * 100 / 255 }) },
  { cmd: '010F', header: '410F', apply: (bytes: number[], data: ObdData) => ({ ...data, intakeC: bytes[0] - 40 }) },
  { cmd: '0142', header: '4142', apply: (bytes: number[], data: ObdData) => ({ ...data, batteryVoltage: (bytes[0] * 256 + bytes[1]) / 1000 }) },
  { cmd: '015C', header: '415C', apply: (bytes: number[], data: ObdData) => ({ ...data, oilC: bytes[0] - 40 }) },
]

export const parseObdBytes = (response: string, header: string) => {
  const clean = response.replace(/[^0-9A-F]/gi, '').toUpperCase()
  const start = clean.indexOf(header)
  if (start < 0) return null
  const bytes: number[] = []
  for (let index = start + header.length; index + 1 < clean.length; index += 2) bytes.push(Number.parseInt(clean.slice(index, index + 2), 16))
  return bytes.length ? bytes : null
}

export function useObd() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ObdData>({})
  const deviceRef = useRef<BleDevice | null>(null)
  const writeRef = useRef<BleCharacteristic | null>(null)
  const bufferRef = useRef('')
  const resolverRef = useRef<((response: string) => void) | null>(null)
  const pollingRef = useRef(false)
  const decoderRef = useRef(new TextDecoder())
  const encoderRef = useRef(new TextEncoder())

  const onNotification = useCallback((event: Event) => {
    const value = (event.target as BleCharacteristic).value
    if (!value) return
    bufferRef.current += decoderRef.current.decode(value)
    if (!bufferRef.current.includes('>')) return
    const response = bufferRef.current.replace(/>/g, '').trim()
    bufferRef.current = ''
    resolverRef.current?.(response)
    resolverRef.current = null
  }, [])

  const send = useCallback((command: string, timeoutMs = 2500) => new Promise<string>((resolve, reject) => {
    const characteristic = writeRef.current
    if (!characteristic) { reject(new Error('Adaptador desconectado')); return }
    bufferRef.current = ''
    const timer = window.setTimeout(() => { resolverRef.current = null; reject(new Error(`Sin respuesta a ${command}`)) }, timeoutMs)
    resolverRef.current = (response) => { window.clearTimeout(timer); resolve(response) }
    const bytes = encoderRef.current.encode(`${command}\r`)
    const write = characteristic.writeValueWithoutResponse ? characteristic.writeValueWithoutResponse(bytes) : characteristic.writeValue(bytes)
    void write.catch((reason) => { window.clearTimeout(timer); resolverRef.current = null; reject(reason) })
  }), [])

  const disconnect = useCallback(() => {
    pollingRef.current = false
    writeRef.current = null
    deviceRef.current?.gatt?.disconnect()
    deviceRef.current = null
    setConnected(false)
    setConnecting(false)
  }, [])

  const poll = useCallback(async () => {
    pollingRef.current = true
    while (pollingRef.current && writeRef.current) {
      for (const pid of PIDS) {
        if (!pollingRef.current) break
        try {
          const bytes = parseObdBytes(await send(pid.cmd), pid.header)
          if (bytes) setData((current) => pid.apply(bytes, current))
        } catch { /* Un PID no compatible no detiene los demás. */ }
        await new Promise((resolve) => window.setTimeout(resolve, 90))
      }
    }
  }, [send])

  const connect = useCallback(async () => {
    const bluetooth = (navigator as Navigator & { bluetooth?: BleApi }).bluetooth
    if (!bluetooth) { setError('Web Bluetooth no está disponible. Usa Chrome en Android con un adaptador OBD BLE.'); return false }
    setConnecting(true)
    setError(null)
    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PROFILES.map((profile) => profile.service) })
      if (!device.gatt) throw new Error('El dispositivo no ofrece Bluetooth GATT')
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', disconnect)
      const server = await device.gatt.connect()
      let notify: BleCharacteristic | null = null
      for (const profile of PROFILES) {
        try {
          const service = await server.getPrimaryService(profile.service)
          notify = await service.getCharacteristic(profile.notify)
          writeRef.current = await service.getCharacteristic(profile.write)
          break
        } catch { /* probar el siguiente perfil */ }
      }
      if (!notify || !writeRef.current) throw new Error('Perfil BLE OBD no reconocido')
      await notify.startNotifications()
      notify.addEventListener('characteristicvaluechanged', onNotification)
      for (const command of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0']) {
        try { await send(command, 4000) } catch { /* algunos ELM omiten comandos AT */ }
      }
      setDeviceName(device.name ?? 'Adaptador OBD')
      setConnected(true)
      setConnecting(false)
      void poll()
      return true
    } catch (reason) {
      disconnect()
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar con el adaptador OBD')
      return false
    }
  }, [disconnect, onNotification, poll, send])

  useEffect(() => disconnect, [disconnect])
  return { supported: Boolean((navigator as Navigator & { bluetooth?: BleApi }).bluetooth), connected, connecting, deviceName, error, data, connect, disconnect }
}
