export type Intent = "chat" | "data";
export interface IntentResult {
  intent: Intent;
  confidence: number; // 0..1
  signals: string[];
}

const DATA_KEYWORDS = [
  // GSC / trafic
  "gsc","google search console","impression","clic","ctr","position","serp","trafic",
  // 404 / crawl
  "404","broken","lien cassé","crawl","scans",
  // agents
  "agent","agents","insight","run","exécution",
  // data/générique
  "bigquery","sql","table","dataset","metrics","statistiques","évolution des clics","timeseries"
];

// Expressions conversationnelles → empêchent Data
const CONVERSATIONAL = [
  "hello","salut","merci","comment ça va","parle-moi","explique","c’est quoi",
  "strategie","stratégie","priorité","roadmap","pricing","offre","partenaire","bpi"
];

function scoreIntent(message: string): IntentResult {
  const m = message.toLowerCase();

  // Hard guard: si salut/merci/explication → chat prioritaire
  const convHits = CONVERSATIONAL.filter(k => m.includes(k));
  if (convHits.length > 0) {
    return { intent: "chat", confidence: 0.95, signals: convHits };
  }

  // Compte les signaux data
  const dataHits = DATA_KEYWORDS.filter(k => m.includes(k));
  const isQuestionNumeric = /(\b%\b|\b\d{1,4}\b|graph|courbe|stat|moyenne|tendance)/.test(m);
  const isComparative = /(\btop\b|\bmax\b|meilleur|le\s+plus|plus\s+d')/.test(m);
  let confidence = 0;

  if (dataHits.length >= 2 || (dataHits.length >= 1 && (isQuestionNumeric || isComparative))) confidence = 0.8;
  else if (dataHits.length === 1) confidence = 0.6;
  else confidence = 0.2;

  return {
    intent: confidence >= 0.75 ? "data" : "chat",
    confidence,
    signals: dataHits
  };
}

export function route(message: string, dataModeEnabled: boolean) {
  const res = scoreIntent(message);

  // Décision de mode: autorise le passage en Data si l'intent est "data" et confiance ≥ 0.75
  // (l'UI affichera ensuite "Je passe en Mode Data Moverz…" et activera le badge)
  const useData = res.intent === "data" && res.confidence >= 0.75;

  return {
    mode: useData ? "data" as const : "general" as const,
    intent: res.intent,
    confidence: res.confidence,
    signals: res.signals
  };
}


