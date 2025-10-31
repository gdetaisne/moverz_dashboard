'use client'

import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function StrategiePage() {
  const [showExplanation, setShowExplanation] = useState(false)
  return (
    <div className="space-y-8">
      <header className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Stratégie</h1>
        <p className="text-slate-600 mt-2">
          Page de référence pour la vision, le business model, le pricing, les segments clients et la roadmap.
          Tu peux compléter cette page librement; elle servira aussi de contexte au chatbot pour t'aider à piloter le business.
        </p>
      </header>

      {/* Section Explication */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors rounded-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600 font-medium">À propos de cette page</span>
          </div>
          {showExplanation ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 text-sm text-slate-600 space-y-2">
            <p>Cette page sert de <strong>référence stratégique</strong> pour documenter la vision, le business model, les segments clients et la roadmap.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Vision & Objectifs</strong> : vision 12-24 mois et KPIs quantifiés (trafic, CA, marge, conversion, NPS)</li>
              <li><strong>Segments & Positionnement</strong> : cibles, besoins, messages clés et différenciation</li>
              <li><strong>Pricing & Offres</strong> : grille tarifaire, packs et politique de facturation</li>
              <li><strong>Go-To-Market</strong> : canaux d&apos;acquisition et objectifs par canal</li>
              <li><strong>Roadmap</strong> : feuille de route trimestrielle (features, ops, data, IA)</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">💡 Le chatbot utilise cette page comme contexte pour t&apos;aider à piloter le business. Complète-la librement avec tes décisions stratégiques.</p>
          </div>
        )}
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">🎯 Vision & Objectifs</h2>
        <p className="text-slate-600 mt-2">Décris la vision 12-24 mois, les objectifs quantifiés (trafic, CA, marge, conversion, NPS...).</p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">👥 Segments Clients & Positionnement</h2>
        <p className="text-slate-600 mt-2">Liste des segments, besoins, messages clés, différenciation.</p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">💰 Pricing & Offres</h2>
        <p className="text-slate-600 mt-2">Grille de prix, packs, remises, politique de facturation.</p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">📈 Go-To-Market & Acquisition</h2>
        <p className="text-slate-600 mt-2">Canaux (SEO, SEA, partenariats, referral), objectifs par canal, ressources.</p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">🗺️ Roadmap</h2>
        <p className="text-slate-600 mt-2">Feuille de route trimestrielle: features, ops, data, IA.</p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">📄 Notes & Hypothèses</h2>
        <p className="text-slate-600 mt-2">Décisions, hypothèses à tester, indicateurs de succès.</p>
      </section>
    </div>
  )
}


