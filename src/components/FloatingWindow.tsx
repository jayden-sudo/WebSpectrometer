// Draggable floating window (shared by Video Input Controls / Info)
// Info window magnetic snap (§10): snaps automatically when dragged within 40px of the window's left/right edge and within 40px of top alignment
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  title: string
  x: number
  y: number
  width: number
  height?: number
  magnetic?: boolean
  onMove: (x: number, y: number) => void
  onClose: () => void
  children: ReactNode
  className?: string
}

export function FloatingWindow({ title, x, y, width, height, magnetic, onMove, onClose, children, className }: Props) {
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const posRef = useRef({ x, y })
  posRef.current = { x, y }

  useEffect(() => {
    if (!drag) return
    const onMoveEv = (e: MouseEvent) => {
      let nx = e.clientX - drag.dx
      let ny = e.clientY - drag.dy
      if (magnetic) {
        // Snap to left edge, right edge, and top
        if (Math.abs(nx) < 40) nx = 0
        if (Math.abs(nx + width - window.innerWidth) < 40) nx = window.innerWidth - width
        if (Math.abs(ny) < 40) ny = 0
      }
      nx = Math.max(0, Math.min(window.innerWidth - 60, nx))
      ny = Math.max(0, Math.min(window.innerHeight - 30, ny))
      onMove(nx, ny)
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMoveEv)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMoveEv)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, magnetic, width, onMove])

  return (
    <div className={className ?? 'info-window'} style={{ left: x, top: y, width, height }}>
      <div
        className="info-window-title"
        onMouseDown={(e) => setDrag({ dx: e.clientX - posRef.current.x, dy: e.clientY - posRef.current.y })}
      >
        <span>{title}</span>
        <span style={{ cursor: 'pointer', padding: '0 4px' }} onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
          ✕
        </span>
      </div>
      {children}
    </div>
  )
}
