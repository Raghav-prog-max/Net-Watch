# ==============================================================================
# NetWatch AI SOC — Production Deployment Handbook
# ==============================================================================

This directory contains production deployment configurations, container specifications, Kubernetes manifests, reverse proxy rules, CI/CD templates, operational scripts, and documentation for running **NetWatch AI SOC**.

**What is verified:** the single-host Docker Compose stack (nginx, API, dashboard, demo replayer), the scripts, and nginx's HTTP and HTTPS sites. **In part:** the monitoring stack. The API's `/metrics` is tested and was checked against a running API, and every metric the Grafana dashboard queries is exposed, but Prometheus and Grafana have not yet been run together in Docker. **Not yet:** the Kubernetes manifests and the CI/CD templates (see their sections).

---

## 📁 Deployment Directory Structure

```text
deployment/
├── README.md                           # Master Production & Deployment Guide (this file)
├── env.production.example              # Every variable the stack reads, documented
├── docker/                             # Hardened Production Container Configurations
│   ├── Dockerfile.api                  # Multi-stage FastAPI backend (non-root, one worker, healthcheck)
│   ├── Dockerfile.dashboard            # Multi-stage Next.js frontend (non-root, healthcheck)
│   ├── Dockerfile.replayer             # Demo traffic replayer (one scenario per run)
│   ├── docker-compose.prod.yml         # Production orchestration (nginx + API + dashboard + replayer)
│   └── docker-compose.monitoring.yml   # Prometheus + Grafana, on the production network
├── nginx/                              # Reverse Proxy, TLS, & Rate Limiting
│   ├── nginx.conf                      # Common settings, upstreams, rate-limit zones
│   ├── netwatch-locations.conf         # Routes: API under /api, dashboard everywhere else
│   ├── site-http.conf                  # Plain HTTP site (NGINX_SITE=http, the default)
│   ├── site-https.conf                 # HTTP→HTTPS redirect, TLS 1.2+, HSTS (NGINX_SITE=https)
│   ├── security-headers.conf           # Security headers (CSP, X-Frame-Options, ...)
│   └── ssl/                            # Certificates from init-ssl.sh (gitignored)
├── k8s/                                # Kubernetes Manifests (not yet consistent, see below)
│   ├── namespace.yaml                  # Dedicated 'netwatch' namespace
│   ├── configmap.yaml                  # Application ConfigMap
│   ├── secrets.template.yaml           # Secrets template
│   ├── pvc.yaml                        # PersistentVolumeClaims for DB and models
│   ├── api-deployment.yaml             # FastAPI deployment (liveness/readiness, non-root)
│   ├── dashboard-deployment.yaml       # Next.js deployment (liveness/readiness)
│   ├── services.yaml                   # ClusterIP internal services
│   ├── ingress.yaml                    # Ingress controller with TLS & WebSocket support
│   └── hpa.yaml                        # Horizontal Pod Autoscalers (HPA)
├── monitoring/                         # Observability Configuration
│   ├── prometheus.yml                  # Scrapes the API's /metrics
│   └── grafana/
│       ├── provisioning/               # Prometheus data source + dashboard provider
│       └── dashboards/                 # The NetWatch telemetry dashboard
├── ci-cd/                              # CI/CD templates: not active (see below)
│   ├── release-pipeline.yml            # GitHub Actions release workflow template
│   └── gitlab-ci.yml                   # GitLab CI/CD alternative template
├── scripts/                            # Operational Automation Scripts
│   ├── deploy.sh                       # Build, start, health-check; roll back on failure
│   ├── rollback.sh                     # Put back the images from before the last deploy
│   ├── backup.sh                       # Snapshot the alert store, models & reports
│   ├── healthcheck.sh                  # End-to-end check through nginx
│   └── init-ssl.sh                     # TLS certificates (Let's Encrypt / self-signed)
└── docs/                               # Detailed Production Documentation
    ├── PRODUCTION_RUNBOOK.md           # Operational runbook: incidents, alerts, retraining
    ├── SECURITY_HARDENING.md           # Security controls and what they need
    ├── DISASTER_RECOVERY.md            # Backup restore, cold rebuilds
    └── ARCHITECTURE_PRODUCTION.md      # Topology & data flow
```

---

## 🚀 Fast Track: Docker Compose Deployment

### 1. Prerequisites
- Docker Engine $\ge 24.0$
- Docker Compose v2 $\ge 2.20$
- Trained models in `models/v1/` (`make data && make train`): the API mounts `models/` and `reports/` from the repository

### 2. Configure Environment
```bash
cp deployment/env.production.example deployment/.env.production
# Edit deployment/.env.production: PUBLIC_URL, NGINX_SITE, ports
```
`PUBLIC_URL` is the address users open. The dashboard is served there and reaches the API at `<PUBLIC_URL>/api` (WebSocket: `<PUBLIC_URL>/api/ws/alerts`); it is baked into the dashboard at build time, so rebuild after changing it.

For HTTPS (`NGINX_SITE=https`), create certificates first:
```bash
bash deployment/scripts/init-ssl.sh netwatch.yourdomain.com letsencrypt you@example.com
```

### 3. One-Command Automated Deployment
```bash
bash deployment/scripts/deploy.sh
```
This script will:
1. Validate dependencies, the environment file, the trained models and (for HTTPS) the certificates.
2. Tag the running images `:previous`, then build the production images.
3. Start `netwatch-api`, `netwatch-dashboard` and `netwatch-nginx` with health checks.
4. Check the API, dashboard pages and a real `/api/score` call through nginx.
5. Roll back to the `:previous` images if the check fails.

### 4. Optional: Replay Demo Traffic
```bash
docker compose -f deployment/docker/docker-compose.prod.yml --env-file deployment/.env.production \
  --profile demo run --rm -e REPLAY_SCENARIO=known replayer
```
It reads `data/` from the repository (processed flows and the splits `make train` writes).

### 5. Optional: Monitoring Stack (Prometheus + Grafana)
```bash
docker compose -f deployment/docker/docker-compose.monitoring.yml --env-file deployment/.env.production up -d
```
Run it after the production stack, whose network it joins. Prometheus scrapes the API's `GET /metrics` (`api/services/telemetry.py`) on that network; nginx keeps `/api/metrics` off the public site, and Prometheus itself listens on this host only (`127.0.0.1:9090`). Grafana (`http://<host>:3001`, user `admin`, `GRAFANA_ADMIN_PASSWORD`, which must be set) comes up with Prometheus as its data source and the *NetWatch AI SOC — Production Telemetry* dashboard in the NetWatch folder:
- flows scored per second, `/score` latency (p95, p99), alerts opened by family;
- the live alert rate per 10k flows beside the report's false-alert rate and budget;
- drift status, the largest feature PSI against its bands, the unexplained-alert rate against its baseline;
- alerts by triage status, the analysts' false-positive share, the model version served.

The counters live in the API process (one worker), so a restart zeroes them; Prometheus' `rate()` allows for that. The drift panels show "No data" until the API has seen 500 benign-looking flows.

Not yet run end to end in Docker: check that Prometheus' target `netwatch-api` is up (`http://127.0.0.1:9090/targets`) and that the dashboard's panels fill once traffic flows.

---

## ☸️ Enterprise Track: Kubernetes Deployment — not yet consistent

The manifests do not match the API yet and are being fixed separately. Until then, do not use them:
- The API keeps state in its process (drift window, alert grouping, WebSocket connections) and its alert store is SQLite, so it must run as **one** replica; the manifests run 2–8 behind an autoscaler on a `ReadWriteOnce` volume.
- The ingress routes `/alerts`, `/models` and `/evaluation` to the API, hiding those dashboard pages; it needs the `/api` prefix nginx now uses.
- `NEXT_PUBLIC_API_URL` is set on the running dashboard, but Next.js only reads it at build time.

---

## 🔧 Operational Scripts Reference

| Script | Purpose | Usage |
|:---|:---|:---|
| [`deploy.sh`](scripts/deploy.sh) | Build, start, health-check; roll back on failure | `bash deployment/scripts/deploy.sh` |
| [`healthcheck.sh`](scripts/healthcheck.sh) | API, dashboard pages and scoring, through nginx | `bash deployment/scripts/healthcheck.sh https://netwatch.yourdomain.com` |
| [`backup.sh`](scripts/backup.sh) | Alert store (online copy), models & reports, 30-day retention | `bash deployment/scripts/backup.sh` |
| [`rollback.sh`](scripts/rollback.sh) | Put back the images from before the last deploy | `bash deployment/scripts/rollback.sh` |
| [`init-ssl.sh`](scripts/init-ssl.sh) | Let's Encrypt or self-signed certificates for nginx | `bash deployment/scripts/init-ssl.sh <domain> [selfsigned\|letsencrypt] [email]` |

To roll back a **model** rather than code, use `python scripts/promote.py v1 --rollback` and restart the API.

---

## 🧩 CI/CD Templates — not active

`ci-cd/release-pipeline.yml` is a GitHub Actions workflow, but GitHub only runs workflows in `.github/workflows/`, and `gitlab-ci.yml` is for GitLab. Neither runs; the repository's CI is `.github/workflows/ci.yml`. Activating the release pipeline is a team decision (it pushes images to a registry).

---

## 📚 Detailed Reference Documentation

- 📖 [**Production Runbook**](docs/PRODUCTION_RUNBOOK.md) — Incident response procedures, false alert spikes, and retraining workflow.
- 🔒 [**Security Hardening Guide**](docs/SECURITY_HARDENING.md) — Non-root users, rate limiting, TLS, and security headers.
- 🔄 [**Disaster Recovery Plan**](docs/DISASTER_RECOVERY.md) — Database recovery, model restore, and cold rebuilds.
- 🏗️ [**Production Architecture**](docs/ARCHITECTURE_PRODUCTION.md) — Network topology and data flow.
