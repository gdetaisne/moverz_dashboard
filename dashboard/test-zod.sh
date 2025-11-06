#!/bin/bash
# Suite de tests complète pour Zod

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 TEST SUITE ZOD - Dashboard API"
echo "================================"
echo ""

# Fonction pour tester une route
test_route() {
  local name="$1"
  local url="$2"
  local expected_success="$3"
  local description="$4"
  
  echo -n "Testing: $name ... "
  result=$(curl -s "$url" | jq -r '.success // .error // "unknown"')
  
  if [ "$expected_success" = "true" ] && [ "$result" = "true" ]; then
    echo -e "${GREEN}✅ PASS${NC} - $description"
    return 0
  elif [ "$expected_success" = "false" ] && [ "$result" != "true" ]; then
    echo -e "${GREEN}✅ PASS${NC} - $description (rejected as expected)"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} - Expected success=$expected_success, got result=$result"
    curl -s "$url" | jq .
    return 1
  fi
}

# Fonction pour tester avec vérification de message d'erreur
test_validation_error() {
  local name="$1"
  local url="$2"
  local expected_message="$3"
  
  echo -n "Testing: $name ... "
  response=$(curl -s "$url")
  success=$(echo "$response" | jq -r '.success // "unknown"')
  
  # Extraire tous les messages d'erreur (peut être plusieurs)
  error_messages=$(echo "$response" | jq -r '[.details[]?.message // .details[] // .error // empty] | join(" | ")')
  
  # Doit être une erreur (success=false) et contenir le message attendu
  if [ "$success" != "true" ] && echo "$error_messages" | grep -qi "$expected_message"; then
    echo -e "${GREEN}✅ PASS${NC} - Rejected avec message(s): $error_messages"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} - Expected error containing '$expected_message', got: $error_messages"
    echo "$response" | jq .
    return 1
  fi
}

PASSED=0
FAILED=0

echo "📊 SECTION 1: /api/metrics/global (Validation days)"
echo "---------------------------------------------------"

test_route "days normal (30)" "$BASE_URL/api/metrics/global?days=30" "true" "days=30 devrait passer" && ((PASSED++)) || ((FAILED++))
test_route "days minimum (1)" "$BASE_URL/api/metrics/global?days=1" "true" "days=1 devrait passer" && ((PASSED++)) || ((FAILED++))
test_route "days maximum (365)" "$BASE_URL/api/metrics/global?days=365" "true" "days=365 devrait passer" && ((PASSED++)) || ((FAILED++))
test_validation_error "days trop grand (9999)" "$BASE_URL/api/metrics/global?days=9999" "365" && ((PASSED++)) || ((FAILED++))
test_validation_error "days négatif (-10)" "$BASE_URL/api/metrics/global?days=-10" "greater than or equal" && ((PASSED++)) || ((FAILED++))
test_validation_error "days = 0" "$BASE_URL/api/metrics/global?days=0" "greater than or equal" && ((PASSED++)) || ((FAILED++))
test_route "days par défaut" "$BASE_URL/api/metrics/global" "true" "Sans param, devrait utiliser default=7" && ((PASSED++)) || ((FAILED++))
test_validation_error "days non-numérique (abc)" "$BASE_URL/api/metrics/global?days=abc" "number" && ((PASSED++)) || ((FAILED++))
test_validation_error "days décimal (30.5)" "$BASE_URL/api/metrics/global?days=30.5" "integer" && ((PASSED++)) || ((FAILED++))

echo ""
echo "📊 SECTION 2: /api/404/history (Validation multi-params)"
echo "---------------------------------------------------------"

test_route "mode=last normal" "$BASE_URL/api/404/history?mode=last&count=5" "true" "mode=last devrait passer" && ((PASSED++)) || ((FAILED++))
test_route "mode=evolution normal" "$BASE_URL/api/404/history?mode=evolution&days=30" "true" "mode=evolution devrait passer" && ((PASSED++)) || ((FAILED++))
test_route "mode par défaut" "$BASE_URL/api/404/history" "true" "Sans mode, devrait utiliser default='last'" && ((PASSED++)) || ((FAILED++))
test_route "count normal (20)" "$BASE_URL/api/404/history?count=20" "true" "count=20 devrait passer" && ((PASSED++)) || ((FAILED++))
test_validation_error "count trop grand (200)" "$BASE_URL/api/404/history?count=200" "100" && ((PASSED++)) || ((FAILED++))
test_validation_error "count = 0" "$BASE_URL/api/404/history?count=0" "greater than or equal" && ((PASSED++)) || ((FAILED++))
test_route "days + count ensemble" "$BASE_URL/api/404/history?days=60&count=10&mode=last" "true" "Plusieurs params valides" && ((PASSED++)) || ((FAILED++))
test_validation_error "days invalide + count invalide" "$BASE_URL/api/404/history?days=-5&count=999" "greater than or equal" && ((PASSED++)) || ((FAILED++))

echo ""
echo "📊 SECTION 3: Vérification format de réponse"
echo "---------------------------------------------"

echo -n "Testing: Format réponse metrics/global ... "
response=$(curl -s "$BASE_URL/api/metrics/global?days=7")
if echo "$response" | jq -e '.success == true and .data != null and .meta.period != null' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS${NC} - Format JSON correct"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Format JSON incorrect"
  echo "$response" | jq .
  ((FAILED++))
fi

echo -n "Testing: Format réponse 404/history ... "
response=$(curl -s "$BASE_URL/api/404/history?mode=last&count=1")
if echo "$response" | jq -e '.success == true and .data.evolution != null and .meta.mode != null' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS${NC} - Format JSON correct"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Format JSON incorrect"
  echo "$response" | jq .
  ((FAILED++))
fi

echo ""
echo "📊 SECTION 4: Gestion d'erreurs Zod"
echo "------------------------------------"

echo -n "Testing: Erreur Zod retourne 400 ... "
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/metrics/global?days=9999")
if [ "$status" = "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Status 400 pour validation échouée"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Expected 400, got $status"
  ((FAILED++))
fi

echo -n "Testing: Détails d'erreur présents ... "
details=$(curl -s "$BASE_URL/api/metrics/global?days=9999" | jq -r '.details[0].message // "none"')
if [ "$details" != "none" ] && [ -n "$details" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Message d'erreur: $details"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Pas de détails d'erreur"
  ((FAILED++))
fi

echo ""
echo "📊 SECTION 5: Routes non-migrées (vérification régression)"
echo "------------------------------------------------------------"
echo -e "${YELLOW}Note: Ces routes peuvent échouer sans credentials BigQuery en dev local${NC}"
echo ""

echo -n "Testing: GET /api/metrics/timeseries répond ... "
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/metrics/timeseries?days=30")
if [ "$status" = "200" ] || [ "$status" = "500" ] || [ "$status" = "503" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Route répond (status $status)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Route ne répond pas (status $status)"
  ((FAILED++))
fi

echo -n "Testing: GET /api/serp/preview répond ... "
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/serp/preview?limit=20")
if [ "$status" = "200" ] || [ "$status" = "500" ] || [ "$status" = "503" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Route répond (status $status)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Route ne répond pas (status $status)"
  ((FAILED++))
fi

echo -n "Testing: GET /api/insights répond ... "
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/insights")
if [ "$status" = "200" ] || [ "$status" = "500" ] || [ "$status" = "503" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Route répond (status $status)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC} - Route ne répond pas (status $status)"
  ((FAILED++))
fi

echo ""
echo "================================"
echo "📊 RÉSULTATS"
echo "================================"
echo -e "${GREEN}✅ Tests passés: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Tests échoués: $FAILED${NC}"
else
  echo -e "${GREEN}❌ Tests échoués: 0${NC}"
fi
echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 Tous les tests passent !${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Certains tests ont échoué${NC}"
  exit 1
fi

