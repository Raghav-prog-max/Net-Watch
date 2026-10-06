#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Automated Backup Script
# ==============================================================================
# Archives the production alert store, model bundles and evaluation reports.
# Implements retention policy (default: keeps backups for 30 days).
#
# The alert store lives in the netwatch-db-data volume, not in the repository:
# this used to archive ./netwatch.db, the developer's local store, and never the
# one production writes. It is copied with SQLite's online backup, so the API
# can keep running.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deployment"
ENV_FILE="${DEPLOY_DIR}/.env.production"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30
COMPOSE=(docker compose -f "${DEPLOY_DIR}/docker/docker-compose.prod.yml")
[ -f "${ENV_FILE}" ] && COMPOSE+=(--env-file "${ENV_FILE}")

mkdir -p "${BACKUP_DIR}"
STAGING="$(mktemp -d)"
trap 'rm -rf "${STAGING}"' EXIT

echo "Starting NetWatch production backup [${TIMESTAMP}]..."

# ── The alert store, from the running API ───────────────────────────────────
if [ -n "$("${COMPOSE[@]}" ps -q api 2> /dev/null)" ]; then
    "${COMPOSE[@]}" exec -T api python -c "
import sqlite3
src = sqlite3.connect('/data/db/netwatch.db')
dst = sqlite3.connect('/data/db/backup.db')
src.backup(dst)
dst.close()
src.close()"
    "${COMPOSE[@]}" cp api:/data/db/backup.db "${STAGING}/netwatch.db"
    "${COMPOSE[@]}" exec -T api rm -f /data/db/backup.db
    echo "Alert store copied from the running API."
else
    # API down: nothing is writing, so a plain copy out of the volume is consistent
    docker run --rm -v netwatch-db-data:/data/db:ro -v "${STAGING}:/out" alpine \
        cp /data/db/netwatch.db /out/ || true
    echo "API not running: copying the alert store straight out of the netwatch-db-data volume."
fi
# A backup without the alert store is the failure this script had before: say so
# and write nothing, rather than an archive that looks complete.
if [ ! -s "${STAGING}/netwatch.db" ]; then
    echo "ERROR: the alert store was not copied; no backup written." >&2
    exit 1
fi

# ── Models (every version and the ACTIVE pointer) and reports ───────────────
for item in models reports; do
    if [ -d "${ROOT_DIR}/${item}" ]; then
        cp -r "${ROOT_DIR}/${item}" "${STAGING}/${item}"
    fi
done

if [ -z "$(ls -A "${STAGING}")" ]; then
    echo "Warning: No database or model files found to backup."
    exit 0
fi

ARCHIVE_NAME="${BACKUP_DIR}/netwatch_backup_${TIMESTAMP}.tar.gz"
tar -czf "${ARCHIVE_NAME}" -C "${STAGING}" .

echo "Backup created successfully: ${ARCHIVE_NAME} ($(du -h "${ARCHIVE_NAME}" | cut -f1))"

# Enforce retention policy: delete archives older than RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "netwatch_backup_*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

echo "Backup procedure completed."
