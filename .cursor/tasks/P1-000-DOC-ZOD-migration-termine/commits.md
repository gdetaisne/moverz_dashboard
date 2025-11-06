# Commits - TASK-000

**Tâche:** Documentation complète + Migration Zod  
**Statut:** ✅ FINALISÉ

---

## Liste des Commits

### c46ea0c - docs: Documentation complète + Migration Zod

**Date:** 2025-01-XX  
**Auteur:** Guillaume

**Message:**
```
docs: Documentation complète + Migration Zod

- Documentation architecture complète (ARCHITECTURE.md, API-ROUTES.md, COMPONENTS.md)
- Guide Quick Start pour Cursor et développeurs
- Stratégie mobile-first documentée avec plan d'action
- Index central de documentation (DOCUMENTATION.md)

- Migration Zod complète sur 7 routes API
- Infrastructure validation (schemas/api.ts, api-helpers.ts)
- Logger structuré intégré (lib/logger.ts)
- Tests automatisés Zod fonctionnels

- README mis à jour avec liens vers nouvelle documentation
```

**Fichiers modifiés:**
- 31 fichiers changés
- +3719 insertions, -819 suppressions

**Principaux changements:**
- Documentation créée (10 nouveaux fichiers .md)
- Migration Zod (10 routes API modifiées)
- Infrastructure (3 nouveaux fichiers lib/)
- Dépendance zod ajoutée

---

### 19daa28 - fix(etl): Accepter exitCode 2 (succès partiel) comme succès

**Date:** 2025-11-06  
**Auteur:** Guillaume

**Message:**
```
fix(etl): Accepter exitCode 2 (succès partiel) comme succès

Le script ETL retourne exitCode 2 quand certains sites échouent 
(ex: permissions GSC manquantes), mais la majorité réussit.

- API /api/etl/run accepte maintenant code 2 comme succès partiel
- Extraction automatique des stats depuis stdout JSON
- Message informatif: 'ETL terminé avec succès partiel (X/Y sites réussi)'
- Code 0 = succès complet, Code 2 = succès partiel, Code 1 = échec

Résout le problème où l'ETL réussissait (10/11 sites) mais l'API 
retournait 500 à cause du code de sortie 2.
```

**Fichiers modifiés:**
- `dashboard/app/api/etl/run/route.ts`
- `.cursor/tasks/P1-000-DOC-ZOD-migration-termine/DIAGNOSTIC-ETL.md`
- `.cursor/tasks/P1-000-DOC-ZOD-migration-termine/VOIR-LOGS-SERVEUR.md`

---

### 771b275 - feat(gsc-issues): Vérification automatique des alertes résolues

**Date:** 2025-11-06  
**Auteur:** Guillaume

**Message:**
```
feat(gsc-issues): Vérification automatique des alertes résolues

Ajout fonctionnalité pour vérifier si les alertes GSC 'open' sont 
toujours présentes dans Google Search Console et les marquer 
automatiquement comme 'resolved' si elles ne le sont plus.

- Fonction verifyExistingIssues(): vérifie toutes les alertes 'open' 
  des 90 derniers jours
- Fonction checkIfIssueStillExists(): vérifie le verdict GSC pour 
  chaque URL (PASS = résolu)
- Mise à jour automatique dans BigQuery via MERGE (batch de 50)
- Fallback individuel si batch échoue

Le dashboard filtre maintenant uniquement les alertes vraiment actives.
Les alertes résolues passent automatiquement en 'resolved' avec 
resolved_at lors de chaque exécution de l'ETL.
```

**Fichiers modifiés:**
- `etl/gsc/fetch-issues.ts`

---

### 9ca153a - feat(gsc-issues): Ajout bouton pour lancer ETL GSC Issues manuellement

**Date:** 2025-11-06  
**Auteur:** Guillaume

**Message:**
```
feat(gsc-issues): Ajout bouton pour lancer ETL GSC Issues manuellement

- Nouvelle route /api/etl/run-issues pour lancer l'ETL GSC Issues
- Bouton 'Vérifier les alertes GSC' dans la page GSC Issues
- Permet de vérifier les alertes existantes et récupérer les nouvelles
- Recharge automatiquement les alertes après l'ETL

Résout le problème où les alertes datent du 03/11 alors qu'on est le 06/11.
Le scheduler n'étant pas actif en production, permet un lancement manuel.
```

**Fichiers modifiés:**
- `dashboard/app/api/etl/run-issues/route.ts` (nouveau)
- `dashboard/app/gsc-issues/page.tsx`

---

**Total commits:** 4  
**Dernière mise à jour:** 2025-11-06

