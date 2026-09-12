interface GaugeProps {
  value: number
  max: number
  label: string
  unit: string
  warningFrom?: number
  size?: number
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function Gauge({
  value,
  max,
  label,
  unit,
  warningFrom = max * 0.78,
  size = 260,
  className = '',
}: GaugeProps) {
  const safeValue = clamp(value, 0, max)
  const ratio = safeValue / max
  const startAngle = 140
  const sweep = 260
  const needleAngle = startAngle + ratio * sweep
  const majorTicks = Array.from({ length: 9 }, (_, index) => index)

  return (
    <figure
      className={`cockpit-gauge ${className}`.trim()}
      aria-label={`${label}: ${Math.round(safeValue)} ${unit}`}
    >
      <svg
        viewBox="0 0 240 240"
        width={size}
        height={size}
        role="img"
        aria-hidden="true"
      >
        <circle className="cockpit-gauge__face" cx="120" cy="120" r="106" />
        <path
          className="cockpit-gauge__track"
          d="M 52 201 A 100 100 0 1 1 188 201"
          pathLength="100"
        />
        <path
          className="cockpit-gauge__progress"
          d="M 52 201 A 100 100 0 1 1 188 201"
          pathLength="100"
          strokeDasharray={`${ratio * 100} 100`}
        />
        {majorTicks.map((tick) => {
          const tickRatio = tick / (majorTicks.length - 1)
          const angle = startAngle + tickRatio * sweep
          const radians = (angle * Math.PI) / 180
          const x1 = 120 + Math.cos(radians) * 85
          const y1 = 120 + Math.sin(radians) * 85
          const x2 = 120 + Math.cos(radians) * 96
          const y2 = 120 + Math.sin(radians) * 96
          const warning = tickRatio * max >= warningFrom
          return (
            <line
              className={warning ? 'cockpit-gauge__tick cockpit-gauge__tick--warning' : 'cockpit-gauge__tick'}
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })}
        <g transform={`rotate(${needleAngle} 120 120)`}>
          <path className="cockpit-gauge__needle" d="M116 124 L207 120 L116 116 Z" />
        </g>
        <circle className="cockpit-gauge__hub" cx="120" cy="120" r="10" />
      </svg>
      <figcaption className="cockpit-gauge__readout">
        <strong>{Math.round(safeValue)}</strong>
        <span>{unit}</span>
        <small>{label}</small>
      </figcaption>
    </figure>
  )
}

export interface SpeedometerProps {
  speed: number
  maxSpeed?: number
  speedLimit?: number
  size?: number
  className?: string
}

export function Speedometer({
  speed,
  maxSpeed = 220,
  speedLimit,
  size,
  className,
}: SpeedometerProps) {
  return (
    <div className="cockpit-gauge-wrap">
      <Gauge
        value={speed}
        max={maxSpeed}
        label="Velocidad"
        unit="km/h"
        warningFrom={speedLimit ?? maxSpeed * 0.75}
        size={size}
        className={className}
      />
      {speedLimit !== undefined && (
        <span className="cockpit-speed-limit" aria-label={`Límite ${speedLimit} kilómetros por hora`}>
          {speedLimit}
        </span>
      )}
    </div>
  )
}

export interface TachometerProps {
  rpm: number
  maxRpm?: number
  redlineRpm?: number
  size?: number
  className?: string
}

export function Tachometer({
  rpm,
  maxRpm = 8000,
  redlineRpm = 6000,
  size,
  className,
}: TachometerProps) {
  return (
    <Gauge
      value={rpm}
      max={maxRpm}
      label="Motor"
      unit="rpm"
      warningFrom={redlineRpm}
      size={size}
      className={className}
    />
  )
}
