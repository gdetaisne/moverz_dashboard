# 📊 PRÉSENTATION PROJET MOVERZ - CONSULTATION ANALYTICS

**Date** : 29 Octobre 2025  
**Version** : 1.0  
**Audience** : Consultant externe Analytics  
**Objectif** : Déterminer la meilleure stratégie d'implémentation d'analytics

---

## 🎯 CONTEXTE BUSINESS

### Qui sommes-nous ?

**Moverz** est une plateforme de mise en relation entre particuliers/entreprises et déménageurs professionnels en France. Notre modèle repose sur la **génération de leads qualifiés** via un réseau de sites localisés par ville.

### Modèle économique

- **Génération de leads** : Utilisateurs demandent des devis via formulaires
- **Monétisation** : Leads vendus aux déménageurs partenaires
- **KPI principal** : Nombre et qualité des leads générés
- **Stratégie** : SEO local agressif (contenu hyper-localisé par ville)

### Ambition

Devenir le **leader français de la mise en relation déménageurs** via :
- Domination SEO local (top 3 Google par ville)
- Qualité des leads (taux de conversion élevé)
- Couverture nationale (11 villes actuellement, objectif 30+)

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack Technologique

| Composant | Technologie | Version | Détails |
|-----------|-------------|---------|---------|
| **Frontend** | Next.js | 14.2.6 | App Router, React 18, SSR/SSG |
| **Langage** | TypeScript | 5.9.2 | Typage strict |
| **Styling** | Tailwind CSS | 3.4.10 | Design system unifié |
| **Déploiement** | CapRover | - | Containers Docker via GitHub webhooks |
| **Hébergement** | VPS | - | CapRover self-hosted |
| **Base de données** | PostgreSQL | - | Prisma ORM |
| **CMS** | Markdown + Gray-matter | - | 1 059 articles en fichiers .md |
| **Validation** | Zod | 4.1.11 | Schémas de données |
| **Node** | Node.js | 24.x | Runtime serveur |

### Infrastructure de déploiement

```
Monorepo GitHub
    ↓ (push)
11 Repositories GitHub individuels (1 par ville)
    ↓ (webhook)
11 Applications CapRover indépendantes
    ↓ (build Docker)
11 Sites en production
```

**⏱️ Temps de déploiement** : 10-15 minutes par site (rebuild Docker complet)

---

## 🌐 ARCHITECTURE MULTI-SITES

### Structure actuelle : 11 sites déployés

| Ville | URL Production | Port Dev | Articles Blog |
|-------|----------------|----------|---------------|
| **Marseille** | [devis-demenageur-marseille.fr](https://devis-demenageur-marseille.fr) | 3020 | 71 |
| **Toulouse** | [devis-demenageur-toulousain.fr](https://devis-demenageur-toulousain.fr) | 3022 | 107 |
| **Lyon** | [devis-demenageur-lyon.fr](https://devis-demenageur-lyon.fr) | 3023 | 100 |
| **Bordeaux** | [bordeaux-demenageur.fr](https://www.bordeaux-demenageur.fr) | 3024 | 105 |
| **Nantes** | [devis-demenageur-nantes.fr](https://devis-demenageur-nantes.fr) | 3025 | 152 |
| **Lille** | [devis-demenageur-lille.fr](https://devis-demenageur-lille.fr) | 3026 | 112 |
| **Nice** | [devis-demenageur-nice.fr](https://devis-demenageur-nice.fr) | 3027 | 60+ |
| **Strasbourg** | [devis-demenageur-strasbourg.fr](https://devis-demenageur-strasbourg.fr) | 3028 | 55 |
| **Rouen** | [devis-demenageur-rouen.fr](https://devis-demenageur-rouen.fr) | 3029 | 51 |
| **Rennes** | [devis-demenageur-rennes.fr](https://devis-demenageur-rennes.fr) | 3030 | 128 |
| **Montpellier** | [devis-demenageur-montpellier.fr](https://devis-demenageur-montpellier.fr) | 3031 | 114 |

**Total** : **1 059 articles de blog** (1 200-1 600 mots chacun)

### Structure du monorepo

```
moverz_main/
├── components/           # Composants partagés (référence)
│   ├── Hero.tsx         # Hero avec animation IA
│   ├── HowItWorks.tsx   # Section "Comment ça marche"
│   ├── StickyCTA.tsx    # CTA flottant (conversion)
│   └── ...
│
├── sites/               # 11 sites autonomes
│   ├── marseille/
│   │   ├── app/         # Pages Next.js
│   │   ├── components/  # Composants (copie synchronisée)
│   │   ├── content/     # Articles blog (MD)
│   │   ├── lib/         # Utilitaires
│   │   ├── public/      # Assets statiques
│   │   ├── Dockerfile   # Build Docker
│   │   └── .git/        # Git repository propre
│   ├── toulouse/
│   └── ...
│
├── content/             # Source des articles (avant sync)
│   ├── marseille/blog/
│   ├── toulouse/blog/
│   └── ...
│
├── scripts/             # Automatisation
│   ├── sync-components.sh        # Sync composants partagés
│   ├── sync-config-files.sh      # Sync configs techniques
│   └── push-all-sites-to-github.sh  # Déploiement 11 sites
│
└── public/              # Assets partagés
    └── images/
```

### Principe de fonctionnement

**Chaque site est complètement isolé** :
- ✅ Repository Git indépendant
- ✅ Déploiement autonome
- ✅ Build Docker séparé
- ✅ URLs et domaines différents
- ✅ Contenu unique (articles par ville)

**Mais partagent** :
- 🔄 Composants UI (Hero, CTA, formulaires)
- 🔄 Styles globaux (Tailwind tokens)
- 🔄 Architecture technique (tsconfig, Dockerfile)

---

## 📝 CONTENU & SEO

### Volume de contenu actuel

| Métrique | Valeur |
|----------|--------|
| **Articles totaux** | 1 059 articles |
| **Contenu total** | ~25 MB de texte |
| **Mots par article** | 1 200-1 600 mots |
| **Note qualité** | 8-9/10 (hyper-localisé) |
| **Maillage interne** | 180+ liens/site |
| **FAQ par article** | 6-8 questions |

### Types de contenu (par ville)

1. **Articles piliers** (~10 articles/ville)
   - Sujets : prix déménagement, garde-meuble, déménageurs pro, etc.
   - Objectif : Ranker sur requêtes principales
   - Exemple : "Prix déménagement Marseille 2025"

2. **Articles satellites** (~40-100 articles/ville)
   - Sujets : questions spécifiques, guides pratiques
   - Objectif : Longue traîne, maillage interne
   - Exemple : "Déménagement étudiant Lyon pas cher"

3. **Pages quartiers** (~6-8 pages/ville)
   - Pages dédiées par quartier (ex: Vieux-Port Marseille)
   - Contenu hyper-localisé (rues, acteurs locaux, prix)

### Stratégie SEO

**Objectif** : Dominer les recherches locales "déménagement [ville]"

**Tactiques** :
- Hyper-localisation (quartiers, acteurs locaux, données prix)
- Maillage interne dense (180+ liens internes/site)
- Structure en silo (piliers → satellites)
- Schema.org LocalBusiness
- Sitemaps dynamiques (récemment implémenté)

**Résultats** (estimations) :
- ~5 000 visites organiques/mois (tous sites)
- Objectif : +30% (→ 6 500 visites/mois) avec optimisations SEO récentes

---

## 🔧 POINTS DE CONVERSION

### Parcours utilisateur cible

```
1. Recherche Google "déménagement marseille"
   ↓
2. Arrivée sur article de blog ou page d'accueil
   ↓
3. Lecture contenu + découverte Moverz
   ↓
4. CTA visible (Hero, Sticky, fin d'article)
   ↓
5. Clic sur CTA "Obtenir un devis gratuit"
   ↓
6. Formulaire de lead (nom, email, téléphone, détails)
   ↓
7. Soumission → Lead généré 🎯
```

### Points de conversion critiques

| Élément | Emplacement | Importance | Actuel |
|---------|-------------|------------|--------|
| **Hero CTA** | Haut de page d'accueil | ⭐⭐⭐⭐⭐ | ✅ Implémenté |
| **Sticky CTA** | Flottant (scroll >40%) | ⭐⭐⭐⭐⭐ | ✅ Implémenté |
| **CTA fin d'article** | Après chaque article blog | ⭐⭐⭐⭐ | ✅ Implémenté |
| **CTA section tarifs** | Section "Combien ça coûte" | ⭐⭐⭐⭐ | ✅ Implémenté |
| **Formulaire lead** | Page dédiée `/devis` | ⭐⭐⭐⭐⭐ | ✅ Implémenté |

### Données actuelles (estimations)

**⚠️ PROBLÈME IDENTIFIÉ : Aucun tracking analytics actuellement**

Métriques supposées (à valider avec analytics) :
- Taux de rebond : ~60-70% (hypothèse)
- Temps sur page : ~2-3 min (hypothèse)
- Taux de clic CTA : ? (non mesuré)
- Taux de conversion formulaire : ? (non mesuré)
- Abandon formulaire : ? (non mesuré)

**→ Besoin critique : mesurer ces métriques**

---

## 📊 BESOINS ANALYTICS IDENTIFIÉS

### 1. Analytics de base (PRIORITAIRE)

**Objectif** : Comprendre le trafic et les comportements

Métriques attendues :
- ✅ Sessions, utilisateurs, pages vues
- ✅ Sources de trafic (organique, direct, référent)
- ✅ Pages les plus visitées
- ✅ Taux de rebond par page
- ✅ Temps moyen sur page
- ✅ Parcours utilisateur (flow)
- ✅ Devices (mobile vs desktop)
- ✅ Géolocalisation (ville, région)

**Question** : Google Analytics 4 ? Alternative ? Multi-domaines ?

### 2. Tracking conversions (CRITIQUE)

**Objectif** : Mesurer l'efficacité des points de conversion

Événements clés à tracker :
- 🎯 **Clic sur CTA** (Hero, Sticky, fin d'article, tarifs)
- 🎯 **Ouverture formulaire lead**
- 🎯 **Début remplissage formulaire**
- 🎯 **Progression formulaire** (étape par étape)
- 🎯 **Soumission formulaire** (lead généré)
- 🎯 **Abandon formulaire** (à quelle étape ?)
- 🎯 **Clic téléphone** (si affichage numéro)

**Question** : Event-driven (GA4) ? Tag Manager ? Segment ?

### 3. Attribution multi-sites (COMPLEXE)

**Problème** : 11 sites indépendants, comment centraliser ?

**Besoins** :
- Vue agrégée des 11 sites
- Comparaison entre villes
- Attribution par ville/source
- Dashboard unifié

**Questions** :
- Propriété GA4 unique ou 11 propriétés séparées ?
- Roll-up property ?
- Data warehouse externe (BigQuery) ?
- Dashboard custom (Looker, Data Studio) ?

### 4. Analytics blog & SEO (IMPORTANT)

**Objectif** : Mesurer performance du contenu

Métriques :
- Articles les plus lus
- Temps de lecture moyen
- Scroll depth (lecture complète ?)
- Sorties sur articles (bounce ?)
- Taux de clic internes (maillage)
- Performance par catégorie d'article (piliers vs satellites)
- Impact SEO : positions keywords, CTR SERP

**Question** : Intégration Google Search Console ?

### 5. Optimisation conversion (AVANCÉ)

**Objectif** : Augmenter le taux de conversion

Besoins :
- **A/B testing** : CTA, couleurs, wording, placement
- **Heatmaps** : Zones cliquées, scroll maps
- **Session replay** : Voir parcours utilisateur réel
- **Analyse entonnoir** : Où perdons-nous les utilisateurs ?

**Questions** : 
- Outils recommandés ? (Hotjar, Clarity, VWO, Optimizely)
- Impact performance ? (Next.js SSR)
- Budget ?

### 6. Performance & Core Web Vitals

**Objectif** : S'assurer que le site reste rapide (impact SEO)

Métriques :
- **LCP** (Largest Contentful Paint) : <2.5s
- **FID** (First Input Delay) : <100ms
- **CLS** (Cumulative Layout Shift) : <0.1
- **TTFB** (Time to First Byte)
- Taux de chargement par page

**Question** : RUM (Real User Monitoring) ? Next.js Analytics ?

---

## 🔐 CONTRAINTES TECHNIQUES

### 1. Architecture Next.js 14 (App Router)

**Implications** :
- ✅ Server Components par défaut (pas de JS côté client automatique)
- ⚠️ Scripts analytics doivent être :
  - Chargés côté client (`'use client'`)
  - Ou injectés via `<Script>` Next.js
- ⚠️ Attention aux hydration mismatches

**Exemple d'implémentation** :
```typescript
// app/ga-listener.tsx (client component)
'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pageview } from '@/lib/gtag'

export function GaListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const url = pathname + searchParams.toString()
    pageview(url)
  }, [pathname, searchParams])
  
  return null
}

// app/layout.tsx (server component)
import Script from 'next/script'
import { GaListener } from './ga-listener'

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </head>
      <body>
        <GaListener />
        {children}
      </body>
    </html>
  )
}
```

### 2. Multi-domaines

**Challenge** : 11 domaines différents

**Options** :
1. **11 propriétés GA4 séparées**
   - ✅ Isolation complète
   - ✅ Simple à mettre en place
   - ❌ Pas de vue agrégée
   - ❌ Gestion complexe (11 configurations)

2. **1 propriété GA4 avec data streams multiples**
   - ✅ Vue agrégée possible
   - ✅ Comparaison inter-villes
   - ❌ Configuration plus complexe
   - ❌ Limite de data streams ?

3. **Roll-up property GA4**
   - ✅ Vue agrégée + détails par site
   - ✅ Meilleure pratique multi-sites
   - ❌ Complexité configuration
   - ⚠️ Compte GA360 nécessaire ?

**Question pour le consultant** : Quelle approche recommandez-vous ?

### 3. Déploiement via monorepo

**Implication** : Modifications propagées sur 11 sites

**Process** :
```bash
# 1. Modifier dans monorepo
code components/GaListener.tsx

# 2. Synchroniser vers 11 sites
./scripts/sync-components.sh

# 3. Déployer vers production
./scripts/push-all-sites-to-github.sh
# → Déclenche 11 rebuilds Docker (~15 min chacun)
```

**⚠️ Considération** :
- Changement d'analytics = redéploiement complet de 11 sites
- Downtime potentiel : 0 (zero-downtime deployments CapRover)
- Temps total : ~2-3 heures pour que les 11 sites soient déployés

**Question** : Impact de redéploiement sur les données analytics ?

### 4. Performance critique

**Enjeu SEO** : Core Web Vitals impact rankings

**Contraintes** :
- ❌ Scripts analytics ne doivent PAS ralentir le site
- ✅ Chargement différé (`strategy="afterInteractive"` ou `"lazyOnload"`)
- ✅ Minimiser taille des scripts
- ✅ Éviter les render-blocking scripts

**Objectifs** :
- LCP < 2.5s (actuellement ~1.8-2.2s)
- FID < 100ms (actuellement ~50-80ms)
- CLS < 0.1 (actuellement ~0.05-0.15)

**Question** : Quel est l'impact performance des solutions proposées ?

### 5. RGPD & Consentement

**Contrainte légale** : Sites français, données UE

**Exigences** :
- ⚠️ Bannière de consentement cookies ?
- ⚠️ Opt-in ou opt-out ?
- ⚠️ Tracking anonymisé par défaut ?
- ⚠️ Politique de confidentialité

**Actuellement** : Aucune gestion du consentement

**Question** : 
- Recommandations pour conformité RGPD ?
- Solutions CMP (Consent Management Platform) ?
- Impact sur la qualité des données si opt-in stricte ?

---

## 💰 BUDGET & RESSOURCES

### Budget analytics (estimation souhaitée)

| Catégorie | Outil Exemple | Coût Estimé | Priorité |
|-----------|---------------|-------------|----------|
| **Analytics de base** | Google Analytics 4 | Gratuit | ⭐⭐⭐⭐⭐ |
| **Tag Management** | Google Tag Manager | Gratuit | ⭐⭐⭐⭐⭐ |
| **Heatmaps & Replays** | Hotjar | 30-80€/mois | ⭐⭐⭐⭐ |
| **A/B Testing** | VWO / Optimizely | 100-500€/mois | ⭐⭐⭐ |
| **Dashboard custom** | Looker Studio | Gratuit | ⭐⭐⭐⭐ |
| **Monitoring perf** | Vercel Analytics | 0-150€/mois | ⭐⭐ |
| **Search Console** | Google SC | Gratuit | ⭐⭐⭐⭐⭐ |
| **CMP (RGPD)** | Axeptio / Cookiebot | 20-100€/mois | ⭐⭐⭐⭐ |

**Budget total souhaité** : 200-500€/mois maximum

**Question** : Quelles sont vos recommandations dans cette fourchette ?

### Ressources humaines

**Équipe actuelle** :
- 1 développeur full-stack (Guillaume)
- 1 AI assistant (moi, Claude) pour développement
- Pas de data analyst dédié

**Compétences** :
- ✅ Développement TypeScript/React/Next.js
- ✅ DevOps (Docker, CapRover, CI/CD)
- ⚠️ Analytics : niveau débutant
- ❌ Data analysis / BI : niveau débutant

**Contrainte** : Solution doit être **simple à maintenir** (pas d'équipe data dédiée)

---

## ❓ QUESTIONS CLÉS POUR LE CONSULTANT

### 1. Architecture analytics multi-sites

**Question** : 
> Comment structurer les propriétés analytics pour 11 sites indépendants mais appartenant à la même marque ?

**Options à évaluer** :
- A) 11 propriétés GA4 séparées
- B) 1 propriété avec 11 data streams
- C) Roll-up property (si GA360)
- D) Solution tierce (Segment, Amplitude, Mixpanel)

**Critères** :
- Vue agrégée possible ?
- Facilité de mise en place
- Coût
- Maintenabilité

---

### 2. Stack recommandée

**Question** :
> Quelle stack analytics recommandez-vous pour nos besoins et contraintes ?

**Éléments à considérer** :
- Analytics de base : GA4 ? Alternative ?
- Tag management : GTM ? Segment ?
- Heatmaps : Hotjar ? Microsoft Clarity ? Autre ?
- A/B testing : VWO ? Google Optimize (deprecated) ? Autre ?
- Dashboard : Looker Studio ? Custom ?

**Trade-offs** :
- Budget vs fonctionnalités
- Facilité d'implémentation vs puissance
- Impact performance vs richesse des données

---

### 3. Implémentation technique

**Question** :
> Comment intégrer proprement analytics dans une architecture Next.js 14 (App Router) multi-sites ?

**Points techniques** :
- Server Components vs Client Components
- Script loading strategy (afterInteractive vs lazyOnload)
- Event tracking : custom hooks ? Context API ?
- Environnements (dev vs prod) : comment éviter de polluer les données ?

**Approche préférée** :
- Bibliothèque tierce (`@vercel/analytics`, `react-ga4`) ?
- Implémentation custom ?
- Wrapper abstrait (changement de provider facile) ?

---

### 4. Tracking événements de conversion

**Question** :
> Comment tracker efficacement les événements clés de conversion (clics CTA, formulaire lead) ?

**Événements à tracker** :
1. Clic CTA Hero
2. Clic CTA Sticky
3. Clic CTA fin d'article
4. Ouverture formulaire lead
5. Progression formulaire (step by step)
6. Soumission formulaire (conversion finale)
7. Abandon formulaire

**Options** :
- Events GA4 manuels (`gtag('event', ...)`)
- Google Tag Manager (triggers)
- Bibliothèque event tracking
- Mixpanel / Amplitude (event-driven natifs)

**Best practices** ?

---

### 5. Attribution & Funnel

**Question** :
> Comment construire un funnel d'attribution complet depuis la recherche Google jusqu'au lead généré ?

**Parcours souhaité** :
```
Google Search
  ↓
Landing page (quelle page ?)
  ↓
Navigation interne (combien de pages ?)
  ↓
Clic CTA (quel CTA ?)
  ↓
Formulaire (abandon ou soumission ?)
  ↓
Lead généré ✅
```

**Questions** :
- UTM parameters systématiques ?
- Tracking du keyword Google (via Search Console API) ?
- Cross-domain tracking (si sous-domaines) ?
- Session stitching ?

---

### 6. Conformité RGPD

**Question** :
> Comment être conforme RGPD tout en collectant des données analytics exploitables ?

**Dilemme** :
- ✅ Légalité (consentement utilisateur)
- ❌ Impact sur données (30-50% d'opt-out en France)

**Options** :
1. Bannière consentement stricte (opt-in) → perte de données
2. Tracking anonymisé sans consentement → données limitées
3. Serveur-side tracking → complexité technique
4. Mode "cookieless" (GA4 consent mode v2) → qualité dégradée

**Recommandation** ?

---

### 7. Performance & Core Web Vitals

**Question** :
> Comment s'assurer que les scripts analytics ne dégradent pas les Core Web Vitals (impact SEO) ?

**Enjeu** : 
- SEO dépend fortement de CWV
- Scripts analytics peuvent ralentir le site
- Compromis à trouver

**Approches** :
- Lazy loading extrême (après interaction utilisateur)
- Serveur-side tracking (pas de JS côté client)
- Minimisation des scripts (bundle size)
- Monitoring des CWV avant/après analytics

**Outils de monitoring recommandés** ?

---

### 8. Dashboard & Reporting

**Question** :
> Quel dashboard recommandez-vous pour suivre les KPIs business au quotidien ?

**KPIs clés à afficher** :
- Trafic organique par ville (graphique tendance)
- Taux de conversion global (%)
- Nombre de leads par jour/semaine/mois
- Coût par lead (CPL) si campagnes payantes
- Pages les plus performantes
- Comparaison inter-villes (ranking)

**Options** :
- Looker Studio (Google Data Studio) : gratuit, facile
- Tableau / Power BI : puissant, coûteux
- Dashboard custom (React + API analytics)
- Outils no-code (Retool, Glide)

**Effort de mise en place** ?

---

### 9. SEO & Search Console

**Question** :
> Comment intégrer Google Search Console avec analytics pour une vue complète SEO ?

**Données souhaitées** :
- Keywords amenant du trafic (par ville)
- Positions moyennes par keyword
- CTR SERP par page
- Impressions vs clics
- Pages indexées vs non-indexées

**Intégration** :
- Lier GSC à GA4 (data import)
- API Search Console (automatisation)
- Dashboard unifié (Looker Studio)

**Recommandations** ?

---

### 10. Roadmap & Priorisation

**Question** :
> Dans quel ordre implémenter les différentes briques analytics ?

**Notre intuition** :
1. **Phase 1** (urgent, 1-2 semaines)
   - Google Analytics 4 de base
   - Tracking page views
   - Sources de trafic
   
2. **Phase 2** (important, 1 mois)
   - Google Tag Manager
   - Events de conversion (clics CTA, formulaire)
   - Funnel d'attribution
   
3. **Phase 3** (optimisation, 2-3 mois)
   - Heatmaps & session replay
   - A/B testing
   - Dashboard custom
   
4. **Phase 4** (avancé, 3-6 mois)
   - Prédiction qualité leads (ML)
   - Attribution multi-touch
   - Optimisation automatique

**Votre avis** : Cette roadmap est-elle cohérente ? Ajustements ?

---

## 📁 RESSOURCES & DOCUMENTATION

### Documentation technique disponible

| Document | Contenu | Usage |
|----------|---------|-------|
| `ARCHITECTURE.md` | Architecture multi-sites complète | Comprendre la structure |
| `CONTEXT.md` | Contexte pour AI / développeurs | Conventions & workflow |
| `DEPLOY.md` | Guide de déploiement | Process de mise en prod |
| `SITES.md` | État des 11 sites (URLs, ports) | Référence des sites |
| `AUDIT-SEO-COMPLET-2025.md` | Audit SEO (1 059 articles) | État du contenu |
| `package.json` | Dépendances Next.js | Stack technique |
| `lib/blog.ts` | Logique blog tenant-aware | Compréhension du contenu |

### Accès possible (si besoin)

- ✅ Code source complet (monorepo)
- ✅ Accès aux 11 sites en production
- ✅ Dashboard CapRover (déploiement)
- ⚠️ Accès Google Search Console (à configurer si besoin)
- ⚠️ Accès base de données (si tracking server-side)

---

## 🎯 LIVRABLES ATTENDUS DU CONSULTANT

### 1. Recommandation stratégique (Document PDF/MD)

**Contenu attendu** :
- Analyse des besoins & contraintes
- Stack analytics recommandée (détail des outils)
- Architecture proposée (GA4, GTM, etc.)
- Justification des choix (trade-offs)
- Conformité RGPD
- Estimation budget (coûts outils + implémentation)
- Roadmap d'implémentation (phases, timelines)

**Format** : 10-20 pages

---

### 2. Plan d'implémentation technique (Document Markdown)

**Contenu attendu** :
- Étapes d'intégration détaillées (1, 2, 3...)
- Code snippets / exemples pour Next.js 14
- Configuration des outils (GA4, GTM, etc.)
- Events tracking (liste + nomenclature)
- Tests à effectuer
- Checklist de validation

**Format** : Markdown avec code examples

---

### 3. Dashboard template (si possible)

**Contenu** :
- Template Looker Studio ou équivalent
- KPIs configurés
- Graphiques essentiels
- Filtres par ville

**Format** : Lien partageable ou export JSON

---

### 4. Session de Q&A (optionnel)

**Format** : Visio 1-2 heures

**Objectif** :
- Clarifications sur les recommandations
- Démonstration d'implémentation
- Réponses aux questions techniques

---

## 📞 INFORMATIONS DE CONTACT

**Projet** : Moverz Multi-Sites  
**Repositories** : 
- Monorepo : `gdetaisne/moverz_main` (GitHub)
- Sites : `gdetaisne/dd-{ville}` (11 repos)

**Contact principal** : Guillaume Stehelin  
**Email** : guillaume@moverz.io  
**Rôle** : Développeur full-stack & Product Owner

---

## 🚀 PROCHAINES ÉTAPES

### Après lecture de ce document

1. **Questions de clarification** (si besoin)
   - Envoyer par email
   - Ou réponse intégrée au livrable

2. **Analyse & Recherche** (consultant)
   - Étude des options
   - Benchmark outils
   - Évaluation contraintes techniques

3. **Livrable recommandation** (délai ?)
   - Format : Document PDF/MD
   - Envoi par email ou partage cloud

4. **Revue & Ajustements** (si nécessaire)
   - Discussion des recommandations
   - Affinement en fonction du budget/faisabilité

5. **Implémentation** (nous ou accompagnement consultant)
   - Phase 1 : Analytics de base
   - Phases 2-4 : Évolution progressive

---

## 📊 ANNEXES

### Annexe A : Exemple de page type

**URL** : https://devis-demenageur-marseille.fr/blog/prix-demenagement-marseille-2025

**Structure** :
```html
<html>
  <head>
    <title>Prix Déménagement Marseille 2025 : Guide Complet</title>
    <meta name="description" content="Découvrez les prix des déménageurs à Marseille en 2025...">
  </head>
  <body>
    <!-- Hero avec CTA -->
    <section id="hero">
      <h1>Prix Déménagement Marseille 2025</h1>
      <button>Obtenir un devis gratuit</button> <!-- 🎯 Conversion #1 -->
    </section>
    
    <!-- Article (1 200-1 600 mots) -->
    <article>
      <p>Contenu hyper-localisé Marseille...</p>
      <!-- Maillage interne (liens vers autres articles) -->
    </article>
    
    <!-- CTA fin d'article -->
    <section id="cta-article">
      <button>Comparer les devis gratuitement</button> <!-- 🎯 Conversion #2 -->
    </section>
    
    <!-- Sticky CTA (flottant) -->
    <div id="sticky-cta">
      <button>Devis gratuit</button> <!-- 🎯 Conversion #3 -->
    </div>
  </body>
</html>
```

**Points de tracking critiques** :
- Clic Hero CTA → `event: 'cta_hero_click'`
- Clic fin d'article CTA → `event: 'cta_article_click'`
- Clic Sticky CTA → `event: 'cta_sticky_click'`
- Scroll depth 50% → `event: 'scroll_50'`
- Scroll depth 100% → `event: 'scroll_100'`

---

### Annexe B : Exemple de formulaire lead

**URL** : https://devis-demenageur-marseille.fr/devis

**Champs du formulaire** :
1. Prénom
2. Nom
3. Email
4. Téléphone
5. Type de déménagement (maison, appartement, bureau)
6. Surface (m²)
7. Nombre de pièces
8. Adresse départ (ville)
9. Adresse arrivée (ville)
10. Date souhaitée
11. Services supplémentaires (garde-meuble, cartons, etc.)
12. Message libre

**Tracking souhaité** :
- `event: 'form_start'` → Début de remplissage
- `event: 'form_step_1'` → Après champ 3 (email)
- `event: 'form_step_2'` → Après champ 7 (détails déménagement)
- `event: 'form_step_3'` → Après champ 10 (tous les champs remplis)
- `event: 'form_submit'` → Soumission réussie (lead généré ✅)
- `event: 'form_abandon'` → Sortie avant soumission

**Métriques clés** :
- Taux de complétion : `form_submit / form_start`
- Taux d'abandon par étape : `form_abandon_stepX / form_stepX`

---

### Annexe C : Composants techniques existants

**Fichiers clés pour intégration analytics** :

1. **`components/StickyCTA.tsx`** : CTA flottant
   - Apparaît après scroll 40%
   - Clic → ouverture formulaire ou redirection `/devis`

2. **`components/Hero.tsx`** : Hero page d'accueil
   - CTA principal "Obtenir un devis"

3. **`components/LeadForm.tsx`** : Formulaire de lead
   - 12 champs (voir Annexe B)
   - Validation Zod
   - Soumission vers API backend (Prisma + PostgreSQL)

4. **`app/layout.tsx`** : Layout global
   - Endroit pour injecter scripts analytics
   - Structure commune à toutes les pages

5. **`lib/blog.ts`** : Logique blog
   - Liste des articles
   - Lecture article (markdown → HTML)
   - Tenant-aware (sépare par ville)

**Points d'injection possibles** :
- `app/layout.tsx` : Scripts globaux (GA4, GTM)
- `app/ga-listener.tsx` : Tracking page views (client component)
- `components/StickyCTA.tsx` : Event tracking clic CTA
- `components/LeadForm.tsx` : Event tracking formulaire

---

## ✅ CHECKLIST DE LECTURE

Avant de commencer l'analyse, assurez-vous d'avoir compris :

- [ ] Contexte business (génération de leads déménagement)
- [ ] Architecture technique (Next.js 14, monorepo, 11 sites)
- [ ] Volume de contenu (1 059 articles, 25 MB)
- [ ] Points de conversion critiques (Hero, Sticky, formulaire)
- [ ] Contraintes (multi-sites, performance, RGPD)
- [ ] Budget souhaité (200-500€/mois)
- [ ] Ressources humaines limitées (1 dev, pas de data analyst)
- [ ] Livrables attendus (recommandation + plan d'implémentation)

---

**🎯 OBJECTIF FINAL** : Mettre en place un système d'analytics complet, simple à maintenir, conforme RGPD, et permettant d'optimiser le taux de conversion (leads générés) sur les 11 sites.

**📅 TIMELINE SOUHAITÉE** : Recommandations sous 1-2 semaines, implémentation Phase 1 sous 1 mois.

---

**Merci pour votre analyse et vos recommandations !** 🙏


