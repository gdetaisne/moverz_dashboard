import { redirect } from 'next/navigation'

// Redirection vers le premier site
export default function SitesPage() {
  redirect('/sites/devis-demenageur-marseille.fr')
}

