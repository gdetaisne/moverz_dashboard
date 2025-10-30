'use client'

import { useState } from 'react'
import ChatBot from './ChatBot'

export default function PersistentChat() {
  const [open, setOpen] = useState(false)
  return (
    <ChatBot isOpen={open} onToggle={() => setOpen(!open)} />
  )
}


