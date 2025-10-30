export default function StrategiePage() {
  return (
    <div className="space-y-8">
      <header className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Stratégie</h1>
        <p className="text-slate-600 mt-2">
          Page de référence pour la vision, le business model, le pricing, les segments clients et la roadmap.
          Tu peux compléter cette page librement; elle servira aussi de contexte au chatbot pour t'aider à piloter le business.
        </p>
      </header>

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


