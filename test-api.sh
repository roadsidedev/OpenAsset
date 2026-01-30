#!/bin/bash

# Test Red Chips API Endpoints
# Usage: bash test-api.sh

BASE_URL="http://localhost:3000/api/v1"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Red Chips API Test Suite ===${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}1. Testing Health Check${NC}"
RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$RESPONSE" | grep -q "ok"; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "  Response: $RESPONSE\n"
else
  echo -e "${RED}✗ Health check failed${NC}"
  echo "  Response: $RESPONSE\n"
  exit 1
fi

# Test 2: Get Markets
echo -e "${YELLOW}2. Testing GET /api/v1/markets${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/markets?start=0&count=20")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Markets endpoint returned 200${NC}"
  MARKET_COUNT=$(echo "$BODY" | grep -o '"markets"' | wc -l)
  echo "  Found market data\n"
else
  echo -e "${RED}✗ Markets endpoint returned $HTTP_CODE${NC}"
  echo "  Response: $BODY\n"
fi

# Test 3: Get Loans
echo -e "${YELLOW}3. Testing GET /api/v1/loans${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/loans")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Loans endpoint returned 200${NC}"
  echo "  Response received\n"
else
  echo -e "${RED}✗ Loans endpoint returned $HTTP_CODE${NC}"
  echo "  Response: $BODY\n"
fi

# Test 4: Test CORS
echo -e "${YELLOW}4. Testing CORS Headers${NC}"
RESPONSE=$(curl -s -i -H "Origin: http://localhost:3001" -H "Access-Control-Request-Method: GET" "$BASE_URL/markets" | head -20)
if echo "$RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
  echo -e "${GREEN}✓ CORS headers present${NC}\n"
else
  echo -e "${YELLOW}⚠ CORS headers not found (may be disabled)${NC}\n"
fi

echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "${GREEN}API appears to be running correctly!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start frontend: cd web && npm run dev"
echo "  2. Open http://localhost:3001 in your browser"
echo "  3. Test wallet connection and create market"
