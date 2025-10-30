'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  results?: any[]
  analysis?: string
  topic?: 'traffic' | '404' | 'agents'
  mode?: 'summary' | 'detail' | 'deepsearch' | 'data'
  extra?: any
}

interface ChatBotProps {
  isOpen?: boolean
  onToggle?: () => void
}

export default function ChatBot({ isOpen = false, onToggle }: ChatBotProps = { isOpen: false }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [dataMode, setDataMode] = useState<boolean>(false)
  const [sizeMode, setSizeMode] = useState<'small' | 'medium' | 'fullscreen'>(() => {
    if (typeof window !== 'undefined') {
      const m = (localStorage.getItem('chatbot_mode') as any) || 'small'
      return (m === 'medium' || m === 'fullscreen') ? m : 'small'
    }
    return 'small'
  })
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = Number(localStorage.getItem('chatbot_w'))
      return Number.isFinite(v) && v >= 320 ? v : 384 // 384px ≈ w-96
    }
    return 384
  })
  const [height, setHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = Number(localStorage.getItem('chatbot_h'))
      return Number.isFinite(v) && v >= 420 ? v : 600
    }
    return 600
  })
  const [resizing, setResizing] = useState<boolean>(false)
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Resize listeners (toujours monté pour respecter les règles des hooks)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isOpen || !resizing || !resizeStartRef.current) return
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y
      const newW = Math.min(800, Math.max(320, resizeStartRef.current.w + dx))
      const newH = Math.min(900, Math.max(420, resizeStartRef.current.h + dy))
      setWidth(newW)
      setHeight(newH)
    }
    function onUp() {
      if (!isOpen) return
      if (resizing) {
        setResizing(false)
        resizeStartRef.current = null
        if (typeof window !== 'undefined') {
          localStorage.setItem('chatbot_w', String(width))
          localStorage.setItem('chatbot_h', String(height))
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isOpen, resizing, width, height])

  const handleSend = async (options?: { mode?: 'summary' | 'detail' | 'deepsearch' | 'data' }) => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, mode: options?.mode || 'summary', dataMode }),
      })

      const data = await response.json()

      if (data.success && data.data) {
        if (data.data.mode === 'data' && !dataMode) {
          // Le routeur a décidé DATA → informer et activer le badge
          const switchMsg: Message = {
            id: (Date.now() + 0.6).toString(),
            role: 'assistant',
            content: '🔄 Je passe en Mode Data Moverz…',
          }
          setDataMode(true)
          setMessages((prev) => [...prev, switchMsg])
        }
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.analysis || 'Analyse complétée',
          sql: data.data.sql,
          results: data.data.results,
          analysis: data.data.analysis,
          mode: data.data.mode,
          topic: data.data.topic,
          extra: data.data.extra,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Erreur inconnue')
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Erreur: ${error.message}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    // Bouton flottant compact
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
        aria-label="Ouvrir le chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    )
  }

  const startResize = (e: React.MouseEvent) => {
    setResizing(true)
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: width, h: height }
  }


  const toggleSize = () => {
    // cycle small -> medium -> fullscreen -> small
    const next = sizeMode === 'small' ? 'medium' : sizeMode === 'medium' ? 'fullscreen' : 'small'
    setSizeMode(next)
    if (next === 'small') {
      setWidth(384); setHeight(600)
    } else if (next === 'medium') {
      setWidth(640); setHeight(720)
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbot_mode', next)
      if (next !== 'fullscreen') {
        localStorage.setItem('chatbot_w', String(next === 'medium' ? 640 : 384))
        localStorage.setItem('chatbot_h', String(next === 'medium' ? 720 : 600))
      }
    }
  }

  return (
    <div
      className={
        sizeMode === 'fullscreen'
          ? 'fixed inset-0 z-50 flex flex-col bg-white rounded-none shadow-2xl border-0'
          : 'fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-lg shadow-2xl border border-slate-200'
      }
      style={sizeMode === 'fullscreen' ? undefined : { width, height }}
    >
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg flex justify-between items-center select-none">
        <div>
          <h2 className="text-lg font-semibold">🤖 Assistant Analytique</h2>
          <p className="text-xs text-white/80">
            {dataMode ? 'Mode Data Moverz activé' : 'Mode généraliste'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSize}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="Taille: petit/moyen/plein écran"
            title="Taille: petit/moyen/plein écran"
          >
            {sizeMode === 'fullscreen' ? (
              // exit fullscreen
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5v4M15 21h4v-4M9 21H5v-4M15 3h4v4" />
              </svg>
            ) : (
              // expand icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 16v4h-4M20 8V4h-4M4 16v4h4" />
              </svg>
            )}
          </button>
          <button
            onClick={onToggle}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="Fermer le chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">👋 Bonjour !</p>
            <p className="text-sm">
              Exemple de questions :
            </p>
            <ul className="text-left mt-3 space-y-1 text-sm">
              <li>• &quot;Quels sites ont le plus d&apos;impressions cette semaine ?&quot;</li>
              <li>• &quot;Quelle est la tendance des clics pour Marseille ?&quot;</li>
              <li>• &quot;Montre-moi les 10 pages les plus performantes&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-900 border border-slate-200'
              }`}
            >
              <p className={`whitespace-pre-wrap leading-relaxed ${message.role === 'user' ? 'text-white' : ''}`}>{message.content}</p>
              
              {message.sql && (
                <details className="mt-2 text-xs">
                  <summary className={`cursor-pointer opacity-80 hover:opacity-100 ${message.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                    📊 Voir la requête SQL
                  </summary>
                  <pre className="mt-2 p-2 bg-slate-900 text-emerald-300 rounded overflow-x-auto">
                    {message.sql}
                  </pre>
                </details>
              )}

              {message.results && message.results.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className={`cursor-pointer opacity-80 hover:opacity-100 ${message.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                    📈 Voir les résultats ({message.results.length} lignes)
                  </summary>
                  <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded overflow-x-auto max-h-60 overflow-y-auto">
                    {JSON.stringify(message.results, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-slate-50 rounded-b-lg relative">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Posez une question..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            →
          </button>
        </div>
        {/* Actions contextuelles pour le dernier message assistant */}
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].mode === 'data' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => handleSend({ mode: 'detail' })}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-100 text-slate-800 hover:bg-slate-200"
            >
              Détailler
            </button>
            <button
              onClick={() => handleSend({ mode: 'deepsearch' })}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Deepsearch
            </button>
            <button
              onClick={() => handleSend({ mode: 'data' })}
              className="px-3 py-1.5 text-xs rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Data
            </button>
          </div>
        )}
      </div>
        {/* Resize handle */}
        {sizeMode !== 'fullscreen' && (
          <div
            onMouseDown={startResize}
            className="absolute -bottom-2 -right-2 w-4 h-4 cursor-se-resize bg-slate-300 rounded-sm border border-slate-400"
            title="Redimensionner"
          />
        )}
    </div>
  )
}

