/**
 * Utilitaires pour l'analyse SERP
 */

export function inferIntentFromContent(
  pageUrl: string,
  title: string | null,
  description: string | null
): string | null {
  // Ordre : URL > Titre > Description
  const urlLower = pageUrl.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const allText = `${urlLower} ${titleLower} ${descLower}`
  
  // Transactional (prioritaire)
  if (/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/.test(allText)) {
    return 'transactional'
  }
  
  // Commercial
  if (/comparer|meilleur|meilleurs|avis|test|top|choisir/.test(allText)) {
    return 'commercial'
  }
  
  // Informational
  if (/guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce/.test(allText)) {
    return 'informational'
  }
  
  // Navigational (détection fine)
  if (/contact|accueil|home|index|a-propos|about/.test(urlLower) && urlLower.split('/').filter(Boolean).length <= 2) {
    return 'navigational'
  }
  
  return null // Incertain
}

export function calculateIntentMatchScore(declared: string | null, inferred: string | null): number {
  if (!declared && !inferred) return 50 // Incertain (pas assez de données)
  if (!declared) return 50 // Intent non déclaré = incertain
  if (!inferred) return 50 // Impossible à déduire = incertain
  
  return declared.toLowerCase() === inferred.toLowerCase() ? 100 : 0
}

export function calculateLengthScore(title: string | null, description: string | null): number {
  // Seuils conservateurs (éviter troncature)
  const TITLE_MAX = 55 // Google tronque souvent avant 60
  const DESC_MAX = 150 // Idem pour 155
  
  let titleOK = false
  let descOK = false
  
  if (title) {
    titleOK = title.length <= TITLE_MAX
  }
  
  if (description) {
    descOK = description.length <= DESC_MAX
  }
  
  // Binaire : 100% si les 2 OK, 0% si aucun, 50% si un seul ou incertain
  if (!title && !description) return 50 // Incertain
  if (titleOK && descOK) return 100
  if (!titleOK && !descOK) return 0
  return 50 // Un seul OK ou incertain
}

