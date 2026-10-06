#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Production Health Check Script
# ==============================================================================
# Checks the stack end to end through nginx: the API under /api, dashboard pages,
# and a real scoring call.
#
# Usage: healthcheck.sh [PUBLIC_URL]     (default http://localhost)
#        CURL_OPTS=-k healthcheck.sh https://localhost   # self-signed certificate
# ==============================================================================

set -euo pipefail

TARGET_HOST="${1:-http://localhost}"
TARGET_HOST="${TARGET_HOST%/}"
API_URL="${TARGET_HOST}/api"
# -L: with NGINX_SITE=https, plain HTTP answers with a redirect
CURL=(curl -sL --connect-timeout 5 --max-time 10 ${CURL_OPTS:-})

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"

    local status_code
    status_code=$("${CURL[@]}" -o /dev/null -w "%{http_code}" "${url}" || echo "000")

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

# The API, through nginx's /api prefix. /models and /metrics/model answer 503
# until models are trained, which is a failed deploy, not a healthy one.
check_endpoint "API root" "${API_URL}/" || FAILURES=$((FAILURES + 1))
check_endpoint "Alert store" "${API_URL}/alerts?size=1" || FAILURES=$((FAILURES + 1))
check_endpoint "Model bundle" "${API_URL}/models" || FAILURES=$((FAILURES + 1))
check_endpoint "Evaluation report" "${API_URL}/metrics/model" || FAILURES=$((FAILURES + 1))
check_endpoint "Drift monitor" "${API_URL}/metrics/drift" || FAILURES=$((FAILURES + 1))

# Dashboard pages, including ones that share a name with an API route: nginx
# used to send /alerts and /models to the API instead
check_endpoint "Dashboard landing page" "${TARGET_HOST}/" || FAILURES=$((FAILURES + 1))
check_endpoint "Dashboard alerts page" "${TARGET_HOST}/alerts" || FAILURES=$((FAILURES + 1))
check_endpoint "Dashboard models page" "${TARGET_HOST}/models" || FAILURES=$((FAILURES + 1))

# POST /score through nginx, in the API's request shape (api/schemas.py). An
# empty batch: a real flow can raise an alert, and deploy.sh runs this check up
# to 20 times, which put made-up alerts in the analysts' queue. The model
# checks above already fail (503) when the models are not loaded.
echo -n "Checking ML scoring endpoint (/api/score)... "
SCORE_RESPONSE=$("${CURL[@]}" -X POST "${API_URL}/score" \
    -H "Content-Type: application/json" \
    -d '{"flows": []}' || echo "ERROR")

if echo "${SCORE_RESPONSE}" | grep -q '"scored":0'; then
    echo -e "${GREEN}[OK] scoring endpoint answers${NC}"
else
    echo -e "${RED}[FAIL] unexpected response: ${SCORE_RESPONSE:0:200}${NC}"
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
