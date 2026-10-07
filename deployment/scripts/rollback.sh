#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Emergency Rollback Script
# ==============================================================================
# Puts back the container images that were running before the last deploy.
# deploy.sh tags them :previous before it builds; this tags them :production
# again and recreates the containers. It used to restart the images it had just
# built, which is not a rollback.
#
# This rolls back code. To roll back a model, use scripts/promote.py
# <version> --rollback and restart the API.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deployment"
ENV_FILE="${DEPLOY_DIR}/.env.production"
COMPOSE=(docker compose -f "${ROOT_DIR}/docker-compose.yml" --env-file "${ENV_FILE}")

echo "=================================================="
echo " [ROLLBACK] Initiating emergency rollback..."
echo "=================================================="

RESTORED=0
for svc in api dashboard; do
    if docker image inspect "netwatch-${svc}:previous" > /dev/null 2>&1; then
        docker tag "netwatch-${svc}:previous" "netwatch-${svc}:production"
        echo "netwatch-${svc}: restored the image from before the last deploy"
        RESTORED=$((RESTORED + 1))
    else
        echo "netwatch-${svc}: no :previous image (first deploy?), left as it is"
    fi
done

if [ "${RESTORED}" -eq 0 ]; then
    echo "[CRITICAL] Nothing to roll back to. Manual intervention required."
    exit 1
fi

"${COMPOSE[@]}" up -d --no-build --force-recreate api dashboard nginx

echo "Running post-rollback health verification..."
set -a; . "${ENV_FILE}"; set +a
sleep 5
for _ in $(seq 1 20); do
    if "${DEPLOY_DIR}/scripts/healthcheck.sh" "${HEALTHCHECK_URL:-${PUBLIC_URL:-http://localhost}}" > /dev/null 2>&1; then
        echo "[SUCCESS] Rollback complete. The previous images are serving traffic."
        exit 0
    fi
    sleep 3
done
"${DEPLOY_DIR}/scripts/healthcheck.sh" "${HEALTHCHECK_URL:-${PUBLIC_URL:-http://localhost}}" || true
echo "[CRITICAL] Rollback health check failed. Manual intervention required."
exit 1
