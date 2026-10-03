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
# 1. Test database integrity
sqlite3 netwatch.db "PRAGMA integrity_check;"

# 2. Stop writing services
docker compose -f deployment/docker/docker-compose.prod.yml stop api

# 3. Locate latest valid backup archive
LATEST_BACKUP=$(ls -t backups/netwatch_backup_*.tar.gz | head -n 1)
echo "Restoring from: ${LATEST_BACKUP}"

# 4. Extract database
tar -xzf "${LATEST_BACKUP}" netwatch.db

# 5. Restart API and verify health
docker compose -f deployment/docker/docker-compose.prod.yml start api
bash deployment/scripts/healthcheck.sh
```

### Scenario 2: Active Model Bundle File Loss or Corruption
If `models/v1/classifier.joblib` or `scaler.joblib` becomes corrupted or fails deserialization:
1. Extract models from backup:
   ```bash
   tar -xzf "${LATEST_BACKUP}" models/
   ```
2. Or rebuild models from baseline data:
   ```bash
   python -m ml.train
   python -m ml.evaluate.report
   ```
3. Restart API service to trigger the model warm-up lifespan:
   ```bash
   docker compose -f deployment/docker/docker-compose.prod.yml restart api
   ```

### Scenario 3: Complete Host Failure (Cold Rebuild)
1. Provision new host with Ubuntu 22.04 LTS / 24.04 LTS.
2. Install Docker and Docker Compose v2:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Clone NetWatch repository:
   ```bash
   git clone https://github.com/satveek-gupta/Net-Watch.git /opt/netwatch
   cd /opt/netwatch
   ```
4. Restore `netwatch.db` and `models/` from cloud backup.
5. Deploy production stack:
   ```bash
   bash deployment/scripts/deploy.sh
   ```
6. Verify DNS and SSL certificates:
   ```bash
   bash deployment/scripts/init-ssl.sh netwatch.yourdomain.com letsencrypt
   ```
