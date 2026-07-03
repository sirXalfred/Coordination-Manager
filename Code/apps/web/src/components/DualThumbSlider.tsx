import { useRef, useCallback, useEffect, useState } from 'react'

interface DualThumbSliderProps {
  min: number
  max: number
  startValue: number
  endValue: number
  onStartChange: (value: number) => void
  onEndChange: (value: number) => void
  onStartRelease: () => void
  onEndRelease: () => void
  /** Minimum gap between start and end (default: 1) */
  minGap?: number
  /** 'horizontal' for mobile, 'vertical' for desktop sidebar */
  orientation?: 'horizontal' | 'vertical'
  /** Label for start thumb */
  startLabel?: string
  /** Label for end thumb */
  endLabel?: string
  className?: string
}

export default function DualThumbSlider({
  min,
  max,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onStartRelease,
  onEndRelease,
  minGap = 1,
  orientation = 'horizontal',
  startLabel,
  endLabel,
  className = '',
}: DualThumbSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'start' | 'end' | null>(null)
  const [hoveredThumb, setHoveredThumb] = useState<'start' | 'end' | null>(null)

  const totalRange = max - min

  // Convert a value to a percentage position on the track
  const valueToPercent = useCallback(
    (value: number) => ((value - min) / totalRange) * 100,
    [min, totalRange]
  )

  // Convert a pixel position on the track to a value (snapped to integer)
  const positionToValue = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current
      if (!track) return min
      const rect = track.getBoundingClientRect()

      let ratio: number
      if (orientation === 'vertical') {
        // For vertical: top = min, bottom = max
        ratio = (clientY - rect.top) / rect.height
      } else {
        ratio = (clientX - rect.left) / rect.width
      }

      ratio = Math.max(0, Math.min(1, ratio))
      return Math.round(min + ratio * totalRange)
    },
    [min, totalRange, orientation]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, thumb: 'start' | 'end') => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = thumb
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()

      const raw = positionToValue(e.clientX, e.clientY)

      if (draggingRef.current === 'start') {
        const clamped = Math.max(min, Math.min(raw, max - minGap))
        onStartChange(clamped)
        // Push end if start would cross
        if (clamped + minGap > endValue) {
          onEndChange(clamped + minGap)
        }
      } else {
        const clamped = Math.min(max, Math.max(raw, min + minGap))
        onEndChange(clamped)
        // Push start if end would cross
        if (clamped - minGap < startValue) {
          onStartChange(clamped - minGap)
        }
      }
    },
    [positionToValue, min, max, minGap, startValue, endValue, onStartChange, onEndChange]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      if (draggingRef.current === 'start') {
        onStartRelease()
      } else {
        onEndRelease()
      }
      draggingRef.current = null
    },
    [onStartRelease, onEndRelease]
  )

  // Also handle track clicks to jump the nearest thumb
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current) return // ignore during drag
      const raw = positionToValue(e.clientX, e.clientY)

      const distToStart = Math.abs(raw - startValue)
      const distToEnd = Math.abs(raw - endValue)

      if (distToStart <= distToEnd) {
        const clamped = Math.max(min, Math.min(raw, endValue - minGap))
        onStartChange(clamped)
        onStartRelease()
      } else {
        const clamped = Math.min(max, Math.max(raw, startValue + minGap))
        onEndChange(clamped)
        onEndRelease()
      }
    },
    [positionToValue, startValue, endValue, min, max, minGap, onStartChange, onEndChange, onStartRelease, onEndRelease]
  )

  // Cleanup on unmount - release any pending drag
  useEffect(() => {
    return () => {
      draggingRef.current = null
    }
  }, [])

  const startPercent = valueToPercent(startValue)
  const endPercent = valueToPercent(endValue)

  const isVertical = orientation === 'vertical'

  // Build wrapper class
  const wrapperClass = isVertical
    ? `dual-thumb-slider dual-thumb-vertical ${className}`
    : `dual-thumb-slider dual-thumb-horizontal ${className}`

  return (
    <div className={wrapperClass}>
      {/* Labels row */}
      {!isVertical && (startLabel || endLabel) && (
        <div className="flex items-center justify-between mb-1">
          {startLabel && <span className="text-xs font-medium text-foreground">{startLabel}</span>}
          {endLabel && <span className="text-xs font-medium text-foreground">{endLabel}</span>}
        </div>
      )}

      {isVertical && startLabel && (
        <span className="block text-sm font-medium text-foreground mb-2 text-center">{startLabel}</span>
      )}

      {/* Track container */}
      <div
        ref={trackRef}
        className="dual-thumb-track-container"
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Background track */}
        <div className="dual-thumb-track" />

        {/* Active range highlight */}
        <div
          className="dual-thumb-range"
          style={
            isVertical
              ? { top: `${startPercent}%`, height: `${endPercent - startPercent}%` }
              : { left: `${startPercent}%`, width: `${endPercent - startPercent}%` }
          }
        />

        {/* Start thumb */}
        <div
          className={`dual-thumb-handle dual-thumb-start ${draggingRef.current === 'start' ? 'active' : ''} ${hoveredThumb === 'start' ? 'hovered' : ''}`}
          style={isVertical ? { top: `${startPercent}%` } : { left: `${startPercent}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'start')}
          onMouseEnter={() => setHoveredThumb('start')}
          onMouseLeave={() => setHoveredThumb(null)}
          role="slider"
          aria-label="Start hour"
          aria-valuemin={min}
          aria-valuemax={endValue - minGap}
          aria-valuenow={startValue}
          tabIndex={0}
        >
          <span className="dual-thumb-tooltip">{startValue.toString().padStart(2, '0')}:00</span>
        </div>

        {/* End thumb */}
        <div
          className={`dual-thumb-handle dual-thumb-end ${draggingRef.current === 'end' ? 'active' : ''} ${hoveredThumb === 'end' ? 'hovered' : ''}`}
          style={isVertical ? { top: `${endPercent}%` } : { left: `${endPercent}%` }}
          onPointerDown={(e) => handlePointerDown(e, 'end')}
          onMouseEnter={() => setHoveredThumb('end')}
          onMouseLeave={() => setHoveredThumb(null)}
          role="slider"
          aria-label="End hour"
          aria-valuemin={startValue + minGap}
          aria-valuemax={max}
          aria-valuenow={endValue}
          tabIndex={0}
        >
          <span className="dual-thumb-tooltip">{endValue.toString().padStart(2, '0')}:00</span>
        </div>
      </div>

      {isVertical && endLabel && (
        <span className="block text-sm font-medium text-foreground mt-2 text-center">{endLabel}</span>
      )}
    </div>
  )
}
