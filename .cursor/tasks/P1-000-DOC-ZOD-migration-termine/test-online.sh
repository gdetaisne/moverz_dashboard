#!/bin/bash
# Script de test en ligne pour P1-000

BASE_URL="${1:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 TESTS EN LIGNE - P1-000"
echo "=========================="
echo "Base URL: $BASE_URL"
echo ""

PASSED=0
FAILED=0

test_route() {
  local name="$1"
  local url="$2"
  local expected_status="$3"
  
  echo -n "Testing: $name ... "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Status: $status)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status)"
    ((FAILED++))
    curl -s "$url" | jq . 2>/dev/null | head -10
    return 1
  fi
}

test_validation_error() {
  local name="$1"
  local url="$2"
  
  echo -n "Testing: $name ... "
  response=$(curl -s "$url")
  success=$(echo "$response" | jq -r '.success // "unknown"')
  
  if [ "$success" = "false" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Validation error caught)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} (Expected validation error)"
    ((FAILED++))
    echo "$response" | jq . | head -5
    return 1
  fi
}

echo "📊 SECTION 1: Validation Valeurs Valides"
echo "----------------------------------------"

test_route "GET /api/metrics/global (default)" "$BASE_URL/api/metrics/global" "200"
test_route "GET /api/metrics/global?days=30" "$BASE_URL/api/metrics/global?days=30" "200"
test_route "GET /api/metrics/global?days=365" "$BASE_URL/api/metrics/global?days=365" "200"

test_route "GET /api/metrics/timeseries (default)" "$BASE_URL/api/metrics/timeseries" "200"
test_route "GET /api/metrics/timeseries?days=30" "$BASE_URL/api/metrics/timeseries?days=30" "200"

test_route "GET /api/metrics/pages (default)" "$BASE_URL/api/metrics/pages" "200"
test_route "GET /api/metrics/pages?limit=0" "$BASE_URL/api/metrics/pages?limit=0" "200"

test_route "GET /api/metrics/queries (default)" "$BASE_URL/api/metrics/queries" "200"

test_route "GET /api/404/history (default)" "$BASE_URL/api/404/history" "200"
test_route "GET /api/404/history?mode=evolution" "$BASE_URL/api/404/history?mode=evolution" "200"

test_route "GET /api/serp/preview (default)" "$BASE_URL/api/serp/preview" "200"

echo ""
echo "📊 SECTION 2: Validation Valeurs Invalides"
echo "--------------------------------------------"

test_validation_error "GET /api/metrics/global?days=9999" "$BASE_URL/api/metrics/global?days=9999"
test_validation_error "GET /api/metrics/global?days=-10" "$BASE_URL/api/metrics/global?days=-10"
test_validation_error "GET /api/metrics/global?days=abc" "$BASE_URL/api/metrics/global?days=abc"

test_validation_error "GET /api/metrics/queries?limit=2000" "$BASE_URL/api/metrics/queries?limit=2000"
test_validation_error "GET /api/404/history?count=200" "$BASE_URL/api/404/history?count=200"

echo ""
echo "📊 SECTION 3: Format Réponse"
echo "----------------------------"

echo -n "Testing: Format JSON /api/metrics/global ... "
response=$(curl -s "$BASE_URL/api/metrics/global")
if echo "$response" | jq -e '.success == true and .data != null and .meta != null' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}"
  ((FAILED++))
fi

echo ""
echo "=========================="
echo "📊 RÉSULTATS"
echo "=========================="
echo -e "${GREEN}✅ Tests passés: $PASSED${NC}"
echo -e "${RED}❌ Tests échoués: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 Tous les tests passent !${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Certains tests ont échoué${NC}"
  exit 1
fi

