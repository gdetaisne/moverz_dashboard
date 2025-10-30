'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  delayMs?: number
}

export default function Tooltip({ content, children, side = 'bottom', delayMs = 100 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const onEnter = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), delayMs)
  }

  const onLeave = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {open && (
        <div
          className={`absolute z-50 w-[320px] max-w-[80vw] rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg ${
            side === 'bottom' ? 'left-1/2 -translate-x-1/2 mt-2' : 'left-1/2 -translate-x-1/2 -top-2 -translate-y-full'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  )
}


