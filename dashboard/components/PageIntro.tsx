'use client'

interface PageIntroProps {
  finalite: string
  tableaux?: string[]
  sources?: string[]
}

export default function PageIntro({ finalite, tableaux = [], sources = [] }: PageIntroProps) {
  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Finalité</div>
          <div>{finalite}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Liste des tableaux</div>
          <ul className="list-disc pl-5 space-y-1">
            {tableaux.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Sources d'informations</div>
          <ul className="list-disc pl-5 space-y-1">
            {sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}


