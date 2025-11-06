# 🧪 Tests en Ligne - P1-000

**Date:** 2025-01-XX  
**Tâche:** P1-000-DOC-ZOD-migration-termine  
**Objectif:** Valider les routes migrées Zod en environnement réel

---

## 📋 Checklist Tests

### ✅ Prérequis
- [ ] Serveur démarré (`npm run dev` ou production)
- [ ] Credentials BigQuery disponibles (si test avec données réelles)
- [ ] Navigateur / Postman / curl disponible

---

## 🔌 Tests par Route

### 1. `/api/metrics/global`

**Tests validation:**
- [ ] `GET /api/metrics/global` (sans param → default=7)
  - ✅ Status 200
  - ✅ Format JSON correct
  - ✅ `days=7` appliqué (vérifier meta.period)

- [ ] `GET /api/metrics/global?days=30`
  - ✅ Status 200
  - ✅ `days=30` appliqué

- [ ] `GET /api/metrics/global?days=365` (limite max)
  - ✅ Status 200

- [ ] `GET /api/metrics/global?days=9999` (invalide)
  - ✅ Status 400
  - ✅ Message d'erreur Zod présent

- [ ] `GET /api/metrics/global?days=-10` (invalide)
  - ✅ Status 400

- [ ] `GET /api/metrics/global?days=abc` (invalide)
  - ✅ Status 400

---

### 2. `/api/metrics/timeseries`

**Tests validation:**
- [ ] `GET /api/metrics/timeseries` (default)
  - ✅ Status 200
  - ✅ Format JSON correct

- [ ] `GET /api/metrics/timeseries?days=30&site=example.com`
  - ✅ Status 200
  - ✅ Paramètres appliqués

- [ ] `GET /api/metrics/timeseries?days=9999` (invalide)
  - ✅ Status 400

---

### 3. `/api/metrics/pages`

**Tests validation:**
- [ ] `GET /api/metrics/pages` (default limit=20)
  - ✅ Status 200

- [ ] `GET /api/metrics/pages?limit=0` (pas de limite)
  - ✅ Status 200
  - ✅ Toutes les pages retournées

- [ ] `GET /api/metrics/pages?limit=10000`
  - ✅ Status 200

- [ ] `GET /api/metrics/pages?limit=abc` (invalide)
  - ✅ Status 400

---

### 4. `/api/metrics/queries`

**Tests validation:**
- [ ] `GET /api/metrics/queries` (default)
  - ✅ Status 200

- [ ] `GET /api/metrics/queries?limit=100`
  - ✅ Status 200

- [ ] `GET /api/metrics/queries?limit=2000` (trop grand)
  - ✅ Status 400

---

### 5. `/api/404/history`

**Tests validation:**
- [ ] `GET /api/404/history` (default mode=last)
  - ✅ Status 200
  - ✅ Format JSON correct
  - ✅ `mode=last` appliqué

- [ ] `GET /api/404/history?mode=evolution&days=30&count=10`
  - ✅ Status 200
  - ✅ Tous les params appliqués

- [ ] `GET /api/404/history?mode=invalid` (invalide)
  - ✅ Status 400 ou default appliqué

- [ ] `GET /api/404/history?count=200` (trop grand)
  - ✅ Status 400

---

### 6. `/api/serp/preview`

**Tests validation:**
- [ ] `GET /api/serp/preview` (default)
  - ✅ Status 200

- [ ] `GET /api/serp/preview?limit=0` (pas de limite)
  - ✅ Status 200

- [ ] `GET /api/serp/preview?limit=10000`
  - ✅ Status 200

---

### 7. `/api/serp/audit` (POST)

**Tests validation:**
- [ ] `POST /api/serp/audit` (default)
  - ✅ Status 200 (ou erreur BigQuery normale si pas de creds)

- [ ] `POST /api/serp/audit?limit=100`
  - ✅ Status 200

- [ ] `POST /api/serp/audit?limit=0` (invalide, min=1 pour audit)
  - ✅ Status 400

---

## 📊 Tests Performance

- [ ] Temps de réponse < 2s pour routes simples
- [ ] Pas d'erreurs console navigateur
- [ ] Pas d'erreurs logs serveur

---

## 🔍 Tests Format Réponses

Pour chaque route valide, vérifier:
- [ ] `success: true` présent
- [ ] `data` présent et format correct
- [ ] `meta` présent avec métadonnées

**Format attendu:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "period": "...",
    "count": number,
    ...
  }
}
```

---

## ❌ Tests Erreurs Zod

Pour chaque route invalide, vérifier:
- [ ] `success: false` présent
- [ ] `error: "Validation failed"` présent
- [ ] `details` array présent avec messages clairs

**Format attendu:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "days",
      "message": "...",
      "code": "..."
    }
  ]
}
```

---

## 🌐 URL de Test

**Local:** `http://localhost:3000`  
**Production:** `[URL production]` (à remplir)

---

## 📝 Résultats

**Date test:** _____________  
**Environnement:** [ ] Local [ ] Production [ ] Staging  
**Tester:** _____________

### Routes testées: ___ / 7
### Tests passés: ___ / [nombre total]
### Erreurs trouvées: ___

---

## 🐛 Bugs Identifiés

*À remplir lors des tests*

---

**Ce fichier sera rempli lors des tests en ligne.**

