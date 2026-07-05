// Custom numeric input box (§14): FloralWhite background, dashed border
// Hold left button and drag up/down = fast adjust; wheel/↑↓ = ±1; typed value applies on Enter/blur; CTRL+click restores default
import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  min: number
  max: number
  step?: number
  defaultValue?: number
  highlight?: boolean // Orange background RGB(255,200,110) when deviating from the default
  width?: number
  decimals?: number
  onChange: (v: number) => void
}

export function NumericBox({ value, min, max, step = 1, defaultValue, highlight, width = 44, decimals = 0, onChange }: Props) {
  const [text, setText] = useState<string | null>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (v: number) => onChange(clamp(v))

  const display = text ?? value.toFixed(decimals)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    // Wheel ±1 (passive:false is required for preventDefault)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      commit(value + (e.deltaY < 0 ? step : -step))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  return (
    <input
      ref={inputRef}
      className={`numeric-box${highlight ? ' numeric-box-highlight' : ''}`}
      style={{ width }}
      value={display}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null) {
          const v = Number.parseFloat(text)
          if (Number.isFinite(v)) commit(v)
          setText(null)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          commit(value + step)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          commit(value - step)
        }
      }}
      onMouseDown={(e) => {
        if (e.ctrlKey && defaultValue !== undefined) {
          e.preventDefault()
          commit(defaultValue)
          return
        }
        if (e.button !== 0) return
        dragRef.current = { startY: e.clientY, startValue: value }
        const onMove = (ev: MouseEvent) => {
          const d = dragRef.current
          if (!d) return
          const dy = d.startY - ev.clientY
          if (Math.abs(dy) > 3) {
            commit(d.startValue + Math.round(dy / 3) * step)
          }
        }
        const onUp = () => {
          dragRef.current = null
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
    />
  )
}
