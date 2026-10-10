#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Automated Production Deployment Script
# ==============================================================================
# Validates the environment, keeps the running images as :previous, builds and
# starts the stack, checks it through nginx, and rolls back to :previous if the
# check fails.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deployment"
ENV_FILE="${DEPLOY_DIR}/.env.production"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── 1. Check Prerequisites ───────────────────────────────────────────────────
log_info "Verifying deployment prerequisites..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH. Please install Docker."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose v2 is required but not found."
    exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
    log_warn "No .env.production file found at ${ENV_FILE}"
    log_info "Creating .env.production from ${DEPLOY_DIR}/.env.production.example..."
    cp "${DEPLOY_DIR}/.env.production.example" "${ENV_FILE}"
    log_warn "Please review and edit ${ENV_FILE} before running in actual production!"
fi
set -a; . "${ENV_FILE}"; set +a
# what users open; the dashboard is built to call <PUBLIC_URL>/api
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
COMPOSE=(docker compose -f "${ROOT_DIR}/docker-compose.yml" --env-file "${ENV_FILE}")

# ── 2. Validate Models and Certificates ──────────────────────────────────────
log_info "Checking trained model artifacts..."
if [ ! -f "${ROOT_DIR}/models/v1/classifier.joblib" ]; then
    log_error "models/v1/classifier.joblib not found: train first (make data && make train)."
    exit 1
fi
if [ "${NGINX_SITE:-http}" = "https" ] && [ ! -f "${DEPLOY_DIR}/nginx/ssl/fullchain.pem" ]; then
    log_error "NGINX_SITE=https but deployment/nginx/ssl/fullchain.pem is missing: run scripts/init-ssl.sh."
    exit 1
fi

# ── 3. Keep What Runs Now, Then Build ────────────────────────────────────────
# rollback.sh restores these if the new build fails its health check. Only the
# image of a container that is running and healthy is kept: tagging whatever
# :production held would, after a failed deploy, replace the good :previous
# with the broken build.
for svc in api dashboard; do
    cid="$("${COMPOSE[@]}" ps -q "${svc}" 2> /dev/null || true)"
    if [ -n "${cid}" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "${cid}" 2> /dev/null)" = "healthy" ]; then
        docker tag "$(docker inspect -f '{{.Image}}' "${cid}")" "netwatch-${svc}:previous"
    else
        log_warn "netwatch-${svc} is not running healthy: keeping the :previous image it has"
    fi
done
log_info "Building production containers with Docker Compose..."
"${COMPOSE[@]}" build --pull

# ── 4. Rollout ───────────────────────────────────────────────────────────────
# The API restarts in place (one container: its state lives in the process), so
# there is a short gap while it loads the models.
log_info "Starting production services in background..."
# `up` itself fails when the API never turns healthy (the dashboard waits on
# it). Under `set -e` that ended the script here, before the rollback below,
# and left the broken build running.
UP_OK=true
"${COMPOSE[@]}" up -d --remove-orphans || UP_OK=false

# ── 5. Run Healthcheck Verification ──────────────────────────────────────────
log_info "Waiting for services to become healthy..."
MAX_ATTEMPTS=20
ATTEMPT=1
HEALTHY=false
[ "${UP_OK}" = true ] || ATTEMPT=$((MAX_ATTEMPTS + 1))

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if "${DEPLOY_DIR}/scripts/healthcheck.sh" "${HEALTHCHECK_URL:-${PUBLIC_URL}}" > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    echo -n "."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done
echo ""

if [ "$HEALTHY" = true ]; then
    log_success "=================================================="
    log_success " NetWatch AI SOC successfully deployed to PROD!"
    log_success " Dashboard: ${PUBLIC_URL}"
    log_success " API:       ${PUBLIC_URL}/api (scoring: POST /api/score)"
    log_success " WebSocket: ${PUBLIC_URL/http/ws}/api/ws/alerts"
    log_success "=================================================="
else
    log_error "Healthcheck timed out or failed:"
    "${DEPLOY_DIR}/scripts/healthcheck.sh" "${HEALTHCHECK_URL:-${PUBLIC_URL}}" || true
    "${COMPOSE[@]}" logs --tail=50
    log_warn "Initiating automated rollback to the images from before this deploy..."
    "${DEPLOY_DIR}/scripts/rollback.sh"
    exit 1
fi
