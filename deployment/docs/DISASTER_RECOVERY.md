# ==============================================================================
# NetWatch AI SOC — Disaster Recovery & Business Continuity Plan
# ==============================================================================

This plan outlines procedures to restore NetWatch operations following hardware failure, data corruption, cloud region outage, or catastrophic disaster.

---

## 1. Target Recovery Objectives

* **Recovery Point Objective (RPO)**: $\le 24$ hours (maximum acceptable data loss).
* **Recovery Time Objective (RTO)**: $\le 15$ minutes (time to restore services from backup).

---

## 2. Backup Inventory & Storage Locations

| Asset | Source Path | Backup Frequency | Target Location |
|:---|:---|:---|:---|
| **Alert Store DB** | `/data/db/netwatch.db` | Daily / Pre-Retrain | `backups/netwatch_backup_*.tar.gz` (S3/GCS bucket) |
| **Active Model Bundle** | `models/v1/` | Post-Promotion | Object storage versioned archive |
| **Evaluation Reports** | `reports/` | Post-Evaluation | Object storage versioned archive |
| **Environment Configs** | `.env.production` | On Change | Encrypted Secrets Vault |

---

## 3. Disaster Recovery Procedures

### Scenario 1: SQLite Database Corruption
If the SQLite database fails integrity check:
```bash
# 1. Test database integrity (the store is in the netwatch-db-data volume)
docker compose -f deployment/docker/docker-compose.prod.yml --env-file deployment/.env.production exec -T api python -c "import sqlite3; print(sqlite3.connect('/data/db/netwatch.db').execute('PRAGMA integrity_check').fetchone())"

# 2. Stop writing services
docker compose -f deployment/docker/docker-compose.prod.yml --env-file deployment/.env.production stop api

# 3. Locate latest valid backup archive
LATEST_BACKUP=$(ls -t backups/netwatch_backup_*.tar.gz | head -n 1)
echo "Restoring from: ${LATEST_BACKUP}"

# 4. Extract the database and copy it into the volume
mkdir -p restore && tar -xzf "${LATEST_BACKUP}" -C restore ./netwatch.db
docker run --rm -v netwatch-db-data:/data/db -v "$PWD/restore:/in:ro" alpine \
    sh -c 'cp /in/netwatch.db /data/db/netwatch.db && chown 10001:10001 /data/db/netwatch.db'

# 5. Restart API and verify health
docker compose -f deployment/docker/docker-compose.prod.yml --env-file deployment/.env.production start api
bash deployment/scripts/healthcheck.sh "${PUBLIC_URL}"
```

### Scenario 2: Active Model Bundle File Loss or Corruption
If a file of the served bundle (`models/<ACTIVE>/`, v1 without the pointer) becomes corrupted or fails deserialization:
1. Extract models from backup:
   ```bash
   tar -xzf "${LATEST_BACKUP}" ./models    # every version and the ACTIVE pointer
   ```
2. Or rebuild models from baseline data:
   ```bash
   python -m ml.train
   python -m ml.evaluate.report
   ```
3. Restart API service to trigger the model warm-up lifespan:
   ```bash
   docker compose -f deployment/docker/docker-compose.prod.yml --env-file deployment/.env.production restart api
   ```

### Scenario 3: Complete Host Failure (Cold Rebuild)
1. Provision new host with Ubuntu 22.04 LTS / 24.04 LTS.
2. Install Docker and Docker Compose v2:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Clone NetWatch repository:
   ```bash
   git clone https://github.com/Raghav-prog-max/Net-Watch.git /opt/netwatch
   cd /opt/netwatch
   ```
4. Restore `models/` and `reports/` from the backup into the repository, and `netwatch.db` into the volume (Scenario 1, step 4).
5. Deploy production stack:
   ```bash
   bash deployment/scripts/deploy.sh
   ```
6. Verify DNS and SSL certificates:
   ```bash
   bash deployment/scripts/init-ssl.sh netwatch.yourdomain.com letsencrypt
   ```
