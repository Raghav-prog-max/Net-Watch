#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Automated Production Deployment Script
# ==============================================================================
# Validates environment, builds production containers, performs zero-downtime
# rollout with health verification, and rolls back on failure.
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
    log_info "Creating .env.production from ${DEPLOY_DIR}/env.production.example..."
    cp "${DEPLOY_DIR}/env.production.example" "${ENV_FILE}"
    log_warn "Please review and edit ${ENV_FILE} before running in actual production!"
fi

# ── 2. Validate Models Exist ─────────────────────────────────────────────────
log_info "Checking trained model artifacts..."
if [ ! -d "${ROOT_DIR}/models/v1" ] || [ ! -f "${ROOT_DIR}/models/v1/classifier.joblib" ]; then
    log_warn "models/v1/classifier.joblib not found. Generating models via make train..."
    (cd "${ROOT_DIR}" && make train)
fi

# ── 3. Build Production Containers ───────────────────────────────────────────
log_info "Building production containers with Docker Compose..."
docker compose \
    -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" \
    --env-file "${ENV_FILE}" \
    build --pull

# ── 4. Zero-Downtime Rollout ─────────────────────────────────────────────────
log_info "Starting production services in background..."
docker compose \
    -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" \
    --env-file "${ENV_FILE}" \
    up -d --remove-orphans

# ── 5. Run Healthcheck Verification ──────────────────────────────────────────
log_info "Waiting for services to become healthy..."
MAX_ATTEMPTS=20
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if "${DEPLOY_DIR}/scripts/healthcheck.sh" > /dev/null 2>&1; then
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
    log_success " Dashboard: http://localhost:80 (or configured domain)"
    log_success " API:       http://localhost:80/score"
    log_success " WebSocket: ws://localhost:80/ws/alerts"
    log_success "=================================================="
else
    log_error "Healthcheck timed out or failed! Viewing recent container logs:"
    docker compose -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" logs --tail=50
    log_warn "Initiating automated rollback to previous container state..."
    "${DEPLOY_DIR}/scripts/rollback.sh"
    exit 1
fi
