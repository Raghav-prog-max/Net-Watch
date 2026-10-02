#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Emergency Rollback Script
# ==============================================================================
# Quickly rolls back production services to previous image tags or restarts.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deployment"
ENV_FILE="${DEPLOY_DIR}/.env.production"

echo "=================================================="
echo " [ROLLBACK] Initiating emergency rollback..."
echo "=================================================="

# Check if docker compose is running
if [ -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" ]; then
    echo "Stopping failing containers..."
    docker compose -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" --env-file "${ENV_FILE}" down || true

    echo "Restarting services using previously cached stable images..."
    docker compose -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml" --env-file "${ENV_FILE}" up -d --no-build

    echo "Running post-rollback health verification..."
    sleep 5
    if "${DEPLOY_DIR}/scripts/healthcheck.sh"; then
        echo "[SUCCESS] Rollback complete. Stable services are serving traffic."
    else
        echo "[CRITICAL] Rollback health check failed. Manual intervention required."
        exit 1
    fi
fi
