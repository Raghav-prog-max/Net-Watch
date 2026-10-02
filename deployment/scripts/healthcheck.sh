#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Production Health Check Script
# ==============================================================================
# Verifies end-to-end operational health of API, Dashboard, and Nginx.
# ==============================================================================

set -euo pipefail

TARGET_HOST="${1:-http://127.0.0.1}"
API_URL="${TARGET_HOST}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"

    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "${url}" || echo "000")

    if [ "${status_code}" -eq "${expected_code}" ]; then
        echo -e "${GREEN}[OK]${NC} ${name}: ${url} (HTTP ${status_code})"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} ${name}: ${url} (HTTP ${status_code}, expected ${expected_code})"
        return 1
    fi
}

echo -e "${BLUE}=== Running NetWatch Production Health Check against ${TARGET_HOST} ===${NC}"

FAILURES=0

# 1. Check API root endpoint
check_endpoint "API Root Status" "${API_URL}/" 200 || FAILURES=$((FAILURES + 1))

# 2. Check Alerts Endpoint
check_endpoint "Alerts Store" "${API_URL}/alerts?limit=1" 200 || FAILURES=$((FAILURES + 1))

# 3. Check Models Status
check_endpoint "Model Bundle Info" "${API_URL}/models" 200 || FAILURES=$((FAILURES + 1))

# 4. Check Evaluation Report Endpoint
check_endpoint "Evaluation Report" "${API_URL}/evaluation" 200 || FAILURES=$((FAILURES + 1))

# 5. Check Dashboard UI
check_endpoint "Dashboard Landing Page" "${TARGET_HOST}/" 200 || FAILURES=$((FAILURES + 1))

# 6. Check ML Scoring Endpoint (Test flow payload)
echo -n "Checking ML Scoring Engine (/score)... "
SCORE_PAYLOAD='[{"Flow Duration": 1200, "Total Fwd Packets": 10, "Total Backward Packets": 8, "Total Length of Fwd Packets": 500, "Total Length of Bwd Packets": 1200}]'
SCORE_RESPONSE=$(curl -s -X POST "${API_URL}/score" \
    -H "Content-Type: application/json" \
    -d "${SCORE_PAYLOAD}" \
    --connect-timeout 5 --max-time 10 || echo "ERROR")

if echo "${SCORE_RESPONSE}" | grep -q "predictions"; then
    echo -e "${GREEN}[OK] Inference active (Dual-engine OK)${NC}"
else
    echo -e "${RED}[FAIL] Scoring engine returned invalid response${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo "=================================================="
if [ ${FAILURES} -eq 0 ]; then
    echo -e "${GREEN}All production health checks PASSED successfully!${NC}"
    exit 0
else
    echo -e "${RED}Production health check encountered ${FAILURES} failure(s).${NC}"
    exit 1
fi
