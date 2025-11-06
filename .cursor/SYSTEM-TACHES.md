# Système de Gestion des Tâches - Dashboard Moverz

**Version:** 1.0  
**Date:** 2025-01-XX

---

## 📋 Principe Fondamental

**Aucun code sans tâche documentée** dans :
- `.cursor/BACKLOG.md` (liste partagée des tâches futures)
- `.cursor/TODO-[Personne].md` (tâches actives en cours)
- `.cursor/tasks/[Priority]-[ID]-[Domaine]-[Description]-[Status]/` (tâche active avec documentation)

---

## 🏷️ Nomenclature des Tâches

**Pattern:** `[Priority]-[ID]-[Domaine]-[Description]-[Status]`

**Exemples:**
- `P1-000-DOC-ZOD-migration-termine`
- `P1-001-MOBILE-migration-pas-commence`
- `P2-003-PERF-optimisation-pas-commence`

**Voir:** `.cursor/NOMENCLATURE-TACHES.md` pour documentation complète.

---

## 🏗️ Structure d'une Tâche

Chaque tâche a son dossier dédié avec nom selon nomenclature :

```
.cursor/tasks/P1-001-MOBILE-migration-pas-commence/
├── README.md        # Description, contexte, objectifs
├── context.md       # Contexte technique détaillé
├── progress.md      # Journal de progression (log sessions)
├── commits.md       # Liste des commits GitHub (SHA documentés)
├── tests.md         # Tests effectués + résultats
└── DONE.md          # Résumé final (si finalisée)
```

**Nom du dossier** doit suivre le pattern: `[Priority]-[ID]-[Domaine]-[Description]-[Status]`

---

## 📊 Statuts des Tâches

| Statut | Signification | Priorité |
|--------|---------------|----------|
| 📋 **À faire** | Tâche identifiée, pas encore démarrée | Selon P0-P3 |
| 🔄 **En cours** | Actuellement travaillée | Active |
| ⚠️ **INCOMPLET** | En pause / incomplète | **Toujours prioritaire** |
| ❌ **ABANDONNÉE** | Annulée (code reverté) | N/A |
| ✅ **FINALISÉ** | Complétée selon DoD | Archive |

### ⚠️ INCOMPLET : Toujours Prioritaire

Une tâche **INCOMPLET** doit être reprise en priorité, peu importe sa priorité P0-P3. Cursor doit toujours vérifier les tâches INCOMPLET avant de démarrer de nouvelles tâches.

---

## ✅ Definition of Done (DoD)

Une tâche est **FINALISÉ** seulement si **3 critères** sont validés :

1. ✅ **Code propre**
   - Formaté et linté
   - Types TypeScript stricts
   - Documentation à jour si nécessaire
   - Pas de code mort

2. ✅ **Commits GitHub documentés**
   - Tous les commits SHA documentés dans `commits.md`
   - Messages de commits clairs
   - Code pushé sur `main` (ou merge request validée)

3. ✅ **Testé et validé**
   - Tests automatisés passent (si applicable)
   - Testé en local (npm run dev)
   - Build réussi (`npm run build`)
   - Testé manuellement sur les fonctionnalités critiques
   - Pas de régression détectée

---

## 🎯 Priorités

| Priorité | Signification | Délai attendu |
|----------|---------------|---------------|
| **P0** | Critique - Bloquant production | Immédiat |
| **P1** | Important - Impact utilisateur | Cette semaine |
| **P2** | Normal - Amélioration utile | Prochain sprint |
| **P3** | Nice-to-have - Si temps disponible | Backlog |

**Règle spéciale :** Les tâches ⚠️ INCOMPLET sont **toujours prioritaires**, même si P3.

---

## 💬 Commandes Cursor

### Créer une Tâche

```
"Cursor, crée la tâche [description complète]"
```

**Cursor doit :**
- Évaluer la priorité (P0-P3)
- Déterminer le domaine (DOC, API, MOBILE, SEO, etc.)
- Estimer le temps
- Créer entrée dans `.cursor/BACKLOG.md`
- Assigner un ID unique séquentiel pour cette priorité
- Nommer selon pattern: `[Priority]-[ID]-[Domaine]-[Description]-pas-commence`

### Démarrer une Tâche

```
"Cursor, je démarre P1-001-MOBILE-migration-pas-commence"
```

**Cursor doit :**
- Créer dossier `.cursor/tasks/P1-001-MOBILE-migration-pas-commence/`
- Renommer dossier si nécessaire: `pas-commence` → `en-cours`
- Créer fichiers README.md, context.md, progress.md, commits.md, tests.md
- Marquer dans BACKLOG.md : 📋 → 🔄
- Mettre à jour nom si renommé: `pas-commence` → `en-cours`
- Ajouter dans TODO-[Personne].md

### Logger une Session

```
"Cursor, log ma session pour P1-001-MOBILE-migration-pas-commence : [fait dans cette session]"
```

**Cursor doit :**
- Ajouter entrée dans `.cursor/tasks/P1-001-MOBILE-migration-pas-commence/progress.md`
- Format : Date + résumé de ce qui a été fait
- Noter les fichiers modifiés/created

### Mettre en Pause

```
"Cursor, je mets P1-001-MOBILE-migration-en-cours en pause : [raison détaillée]"
```

**Cursor doit :**
- Marquer statut : 🔄 → ⚠️ INCOMPLET
- Renommer dossier si nécessaire: `en-cours` → `en-pause`
- Mettre à jour nom dans BACKLOG.md
- Logger état actuel dans `progress.md`
- Documenter raison dans `progress.md`
- Noter ce qui reste à faire
- Garder dans TODO pour rappel (statut spécial)

### Abandonner une Tâche

```
"Cursor, j'abandonne P1-001-MOBILE-migration-en-cours : [raison détaillée]"
```

**Cursor doit :**
1. **Lister tous les commits** associés à cette tâche (SHA)
2. **Proposer revert** : `git revert SHA1 SHA2 ...`
3. **Nettoyer code** : Supprimer fichiers créés uniquement pour cette tâche
4. **Vérifier git status** : Doit être clean après nettoyage
5. **Renommer dossier** : `en-cours` → `abandonnee`
6. **Marquer** : ❌ ABANDONNÉE dans BACKLOG.md
7. **Documenter raison** dans `.cursor/tasks/P1-001-MOBILE-migration-abandonnee/progress.md`

### Finaliser une Tâche

```
"Cursor, finalise P1-001-MOBILE-migration-en-cours"
```

**Cursor doit :**
- ✅ Vérifier **DoD (3 critères)** :
  1. Code propre ✓
  2. Commits documentés ✓
  3. Testé et validé ✓
- Si tous OK : Créer `DONE.md` avec résumé
- Renommer dossier si nécessaire: `en-cours` → `termine`
- Marquer : ✅ FINALISÉ dans BACKLOG.md
- Retirer de TODO-[Personne].md
- Archiver (garder dossier pour historique)

### Clean Tasks (Fin de Journée)

```
"Cursor, clean tasks"
```

**Cursor doit proposer workflow interactif :**
1. Logger sessions non loguées → `progress.md`
2. Documenter commits récents → `commits.md`
3. Mettre à jour statuts → BACKLOG.md / TODO
4. Identifier tâches stagnantes (en cours > 3 jours)
5. Nettoyer fichiers temporaires
6. Proposer pause si nécessaire

---

## 🔄 Workflow Complet

```
BACKLOG.md (📋 À faire)
    ↓
TODO-[Personne].md (🔄 En cours)
    ↓
.cursor/tasks/TASK-XXX/ (Travail actif)
    ↓ Code + log progress.md
    ↓
Finalisation (DoD vérifiée)
    ↓
DONE.md créé
    ↓
✅ FINALISÉ dans BACKLOG.md
```

**Mise en pause :**
```
🔄 En cours → ⚠️ INCOMPLET (prioritaire)
    ↓ (reprise)
🔄 En cours → ✅ FINALISÉ
```

**Abandon :**
```
🔄 En cours → ❌ ABANDONNÉE
    ↓ Revert commits
    ↓ Nettoyage code
    ↓ git status clean
```

---

## 📁 Structure des Fichiers

### `.cursor/BACKLOG.md`
Liste partagée de toutes les tâches avec statuts.

**Format:**
```markdown
## TASK-001 - Migration mobile-first complète
**Statut:** 📋 À faire  
**Priorité:** P1  
**Assigné:** Guillaume  
**Estimation:** 2-3 semaines

Description...
```

### `.cursor/TODO-Guillaume.md`
Tâches actives de Guillaume.

**Format:**
```markdown
## 🔄 En cours
- TASK-001 - Migration mobile-first

## ⚠️ INCOMPLET (prioritaires)
- TASK-002 - Optimisation performance

## À reprendre cette semaine
- TASK-003 - Feature X
```

### `.cursor/tasks/TASK-XXX/README.md`
Description principale de la tâche.

**Format:**
```markdown
# TASK-XXX - Titre

**Statut:** 🔄 En cours  
**Priorité:** P1  
**Créée:** 2025-01-XX  
**Assignée:** Guillaume

## Objectifs
- Objectif 1
- Objectif 2

## Critères de succès
- Critère 1
- Critère 2
```

---

## 🎯 Adaptation Dashboard

### DoD Adapté

Pour le dashboard, le critère "testé sur 2+ sites live" devient :
- ✅ Testé localement (`npm run dev`)
- ✅ Build réussi (`npm run build`)
- ✅ Tests automatisés passent (`./test-zod.sh` si applicable)
- ✅ Testé manuellement sur fonctionnalités critiques
- ✅ Pas de régression détectée

### Contexte Spécifique

- **Personne assignée:** Généralement Guillaume
- **Cursor:** Toujours disponible comme assistant
- **Commits:** Toujours sur `main` (pas de branches pour l'instant)
- **Tests:** Tests Zod pour API, tests manuels pour UI

---

## 📝 Exemples

### Exemple 1: Créer une Tâche

**User:** "Cursor, crée la tâche : Implémenter migration mobile-first complète selon MOBILE-FIRST-STRATEGY.md"

**Cursor:**
- Évalue : P1 (important mais pas bloquant)
- Estimation : 2-3 semaines (4 phases)
- Crée entrée dans BACKLOG.md : TASK-001
- Propose de démarrer maintenant ou plus tard

### Exemple 2: Logger Session

**User:** "Cursor, log ma session pour TASK-001 : J'ai migré Navigation.tsx et MetricCard.tsx pour mobile-first. Ajouté classes responsive. Testé sur iPhone et Android."

**Cursor:**
- Ajoute dans `progress.md` :
```markdown
## 2025-01-XX - Session Guillaume

**Fait:**
- Migration Navigation.tsx (mobile menu optimisé)
- Migration MetricCard.tsx (responsive text sizes)
- Tests sur iPhone 12 et Android Chrome

**Fichiers modifiés:**
- components/Navigation.tsx
- components/MetricCard.tsx

**Prochaine étape:**
- Migrer DataTable.tsx (table → cards sur mobile)
```

### Exemple 3: Mettre en Pause

**User:** "Cursor, je mets TASK-001 en pause : Je dois prioriser un bug critique d'abord"

**Cursor:**
- Change statut : 🔄 → ⚠️ INCOMPLET
- Note dans progress.md :
```markdown
## Mise en pause - 2025-01-XX

**Raison:** Bug critique P0 à résoudre d'abord

**État actuel:**
- Navigation.tsx ✅
- MetricCard.tsx ✅
- DataTable.tsx ⏸️ (non commencé)

**À reprendre:**
- DataTable.tsx (Phase 2, priorité)
- Composants restants (Phase 2-3)
```

---

## ✅ Avantages du Système

1. **Historique clair** : Tout ce qui a été fait est documenté
2. **Reprise facile** : Les tâches INCOMPLET sont facilement repérables
3. **Context préservé** : Le contexte technique est gardé avec chaque tâche
4. **Accountability** : Commits documentés pour traçabilité
5. **Structuration** : Travail organisé et professionnel

---

**Ce système sera utilisé pour toutes les futures tâches du dashboard.**

