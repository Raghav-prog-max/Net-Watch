# ==============================================================================
# NetWatch AI SOC — Production Operational Runbook
# ==============================================================================

This runbook guides site reliability engineers (SREs) and SOC platform engineers through routine maintenance, incident response, troubleshooting, and model retraining in production environments.

---

## 1. Quick Emergency Commands

### Inspect Service Status & Logs
```bash
# Docker Compose production stack
docker compose -f deployment/docker/docker-compose.prod.yml ps
docker compose -f deployment/docker/docker-compose.prod.yml logs -f --tail=100 api
docker compose -f deployment/docker/docker-compose.prod.yml logs -f --tail=100 dashboard

# Kubernetes cluster
kubectl get pods,svc,ingress -n netwatch
kubectl logs -f deployment/netwatch-api -n netwatch --tail=100
kubectl logs -f deployment/netwatch-dashboard -n netwatch --tail=100
```

### Restart Failing Services
```bash
# Docker Compose
docker compose -f deployment/docker/docker-compose.prod.yml restart api
docker compose -f deployment/docker/docker-compose.prod.yml restart dashboard

# Kubernetes
kubectl rollout restart deployment/netwatch-api -n netwatch
kubectl rollout restart deployment/netwatch-dashboard -n netwatch
```

---

## 2. Common Production Incidents & Remediation

### Incident A: API Returns HTTP 503 "Models Not Found"
* **Symptoms**: `/score`, `/models`, or `/metrics/drift` returns `503 Service Unavailable`.
* **Root Cause**: The model bundle (`models/v1/classifier.joblib`, `scaler.joblib`, etc.) is missing or corrupted on the mounted volume.
* **Resolution**:
  1. Check if model files exist:
     ```bash
     ls -la models/v1/
     ```
  2. If missing, restore from the latest backup or re-run evaluation:
     ```bash
     bash deployment/scripts/backup.sh  # check available backups
     # Or regenerate models:
     python -m ml.train
     python -m ml.evaluate.report
     ```
  3. Restart the API container to re-trigger the warm-up lifespan:
     ```bash
     docker compose -f deployment/docker/docker-compose.prod.yml restart api
     ```

### Incident B: False Alert Rate Spikes (> 50 / 10k Flows)
* **Symptoms**: Dashboard banner turns amber/red; alert rail flooded with Benign traffic labeled as attacks.
* **Diagnosis**:
  1. Query active drift metrics:
     ```bash
     curl -s http://localhost:8000/metrics/drift | jq .
     ```
  2. Inspect whether a network topology shift or new benign software is generating unfamiliar feature distributions.
* **Resolution**:
  1. Review analyst triage labels in SQLite:
     ```bash
     sqlite3 netwatch.db "SELECT analyst_label, COUNT(*) FROM alerts GROUP BY analyst_label;"
     ```
  2. Trigger feedback retraining with analyst labels:
     ```bash
     python -m scripts.retrain --eval-v1
     ```
  3. Validate candidate v2 model:
     - Check `reports/v2/promotion.json`.
     - Only promote if validation false alert rate $\le$ budget and macro-F1 is preserved.

### Incident C: WebSocket Disconnections on Live Alert Rail
* **Symptoms**: Dashboard shows "Disconnected" dot; live alerts do not stream until page reload.
* **Diagnosis**:
  - Check Nginx proxy error log for `closed connection while reading upstream` or `WebSocket handshake failed`.
* **Resolution**:
  - Ensure Nginx has proper upgrade headers configured in `nginx.conf`:
    ```nginx
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 86400s;
    ```
  - Verify container health: `bash deployment/scripts/healthcheck.sh`.

---

## 3. Production Model Retraining Workflow

NetWatch is designed so that human analyst triage continuously informs future model generations.

```mermaid
flowchart LR
    A["Analyst Feedback in SOC UI"] --> B["Stored in netwatch.db"]
    B --> C["scripts/retrain.py"]
    C --> D["Candidate v2 Trained"]
    D --> E["Evaluated on Honest Time-Split"]
    E --> F{"Passes Promotion Gate?"}
    F -->|Yes| G["Promote v2 to Active"]
    F -->|No| H["Retain v1 & Alert Lead"]
```

### Retraining Execution Procedure
1. Create a pre-retraining snapshot:
   ```bash
   bash deployment/scripts/backup.sh
   ```
2. Run retraining pipeline:
   ```bash
   python -m scripts.retrain --eval-v1
   ```
3. Inspect promotion results:
   ```bash
   cat reports/v2/promotion.json
   ```
4. If approved for rollout, restart the API service:
   ```bash
   docker compose -f deployment/docker/docker-compose.prod.yml restart api
   ```

---

## 4. Routine Maintenance Checklist

| Frequency | Task | Command / Action |
|:---|:---|:---|
| **Daily** | Verify health check status | `bash deployment/scripts/healthcheck.sh` |
| **Daily** | Automated database backup | Crontab running `deployment/scripts/backup.sh` |
| **Weekly** | Review drift & KS statistics | Check `/metrics/drift` and Grafana dashboard |
| **Monthly** | Prune stale alerts older than 90 days | `sqlite3 netwatch.db "DELETE FROM alerts WHERE timestamp < date('now', '-90 days');"` |
| **Quarterly** | Security scans & base image updates | `docker buildx build --no-cache ...` |
