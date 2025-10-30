'use client'

import { useEffect, useState } from 'react'

export default function StrategieSettingsPage() {
  const [markdown, setMarkdown] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Précharger depuis l'API (si fichiers existent)
    fetch('/api/settings/strategy')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setMarkdown(j.data.markdown || '')
          setJsonText(j.data.json || '')
        }
      })
      .catch(() => {})
  }, [])

  async function save() {
    const res = await fetch('/api/settings/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, jsonText }),
    })
    const j = await res.json()
    if (j.success) {
      setSavedAt(j.savedAt)
      // Vider les champs après enregistrement
      setMarkdown('')
      setJsonText('')
    } else {
      alert('Erreur: ' + (j.error || 'enregistrement'))
    }
  }

  const charsMd = markdown.length
  const charsJson = jsonText.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Stratégie (Paramètres)</h1>
        <p className="text-slate-600 mt-2">
          Colle ici la vision, le business model, le pricing, les segments clients, la roadmap et toute information utile au pilotage.
          Ces données pourront être utilisées par l'assistant (mode Data Moverz) pour contextualiser ses réponses.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Markdown</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">{charsMd.toLocaleString()} caractères</span>
          {savedAt && (
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Enregistré: {new Date(savedAt).toLocaleString('fr-FR')}</span>
          )}
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Colle ici ta stratégie (Markdown)."
          className="w-full h-[300px] border border-slate-300 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">JSON</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">{charsJson.toLocaleString()} caractères</span>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='Colle ici les métadonnées (JSON valide).'
          className="w-full h-[250px] border border-slate-300 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Enregistrer</button>
        <button onClick={() => { setMarkdown(''); setJsonText('') }} className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200">Vider</button>
      </div>
    </div>
  )
}


