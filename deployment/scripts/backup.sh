#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — Automated Backup Script
# ==============================================================================
# Archives SQLite database, model bundles, and evaluation reports.
# Implements retention policy (default: keeps backups for 30 days).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "Starting NetWatch production backup [${TIMESTAMP}]..."

ARCHIVE_NAME="${BACKUP_DIR}/netwatch_backup_${TIMESTAMP}.tar.gz"

# Collect items to backup
BACKUP_ITEMS=()

if [ -f "${ROOT_DIR}/netwatch.db" ]; then
    BACKUP_ITEMS+=("netwatch.db")
fi

if [ -d "${ROOT_DIR}/models" ]; then
    BACKUP_ITEMS+=("models")
fi

if [ -d "${ROOT_DIR}/reports" ]; then
    BACKUP_ITEMS+=("reports")
fi

if [ ${#BACKUP_ITEMS[@]} -eq 0 ]; then
    echo "Warning: No database or model files found to backup."
    exit 0
fi

# Create compressed archive from root directory
tar -czf "${ARCHIVE_NAME}" -C "${ROOT_DIR}" "${BACKUP_ITEMS[@]}"

echo "Backup created successfully: ${ARCHIVE_NAME} ($(du -h "${ARCHIVE_NAME}" | cut -f1))"

# Enforce retention policy: delete archives older than RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "netwatch_backup_*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

echo "Backup procedure completed."
