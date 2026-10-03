# ==============================================================================
# NetWatch AI SOC — Production Deployment Handbook
# ==============================================================================

This directory contains production deployment configurations, container specifications, Kubernetes manifests, reverse proxy rules, CI/CD pipelines, operational scripts, and documentation for running **NetWatch AI SOC** at scale.

---

## 📁 Deployment Directory Structure

```text
deployment/
├── README.md                           # Master Production & Deployment Guide (this file)
├── env.production.example              # Template for production environment variables
├── docker/                             # Hardened Production Container Configurations
│   ├── Dockerfile.api                  # Multi-stage FastAPI backend (non-root, OpenMP, healthcheck)
│   ├── Dockerfile.dashboard            # Multi-stage Next.js frontend (non-root, healthcheck)
│   ├── Dockerfile.replayer             # Background traffic flow replayer service
│   ├── docker-compose.prod.yml         # Production orchestration (API + Dashboard + Nginx + DB)
│   ├── docker-compose.monitoring.yml   # Prometheus + Grafana observability stack
│   └── .dockerignore                   # Build context exclusions
├── nginx/                              # Reverse Proxy, SSL, & Rate Limiting
│   ├── nginx.conf                      # Master Nginx configuration (WebSockets, caching, proxying)
│   └── security-headers.conf           # Hardened HTTP security headers (HSTS, CSP, X-Frame)
├── k8s/                                # Production Kubernetes Manifests
│   ├── namespace.yaml                  # Dedicated 'netwatch' namespace
│   ├── configmap.yaml                  # Application ConfigMap
│   ├── secrets.template.yaml           # Secrets template (JWT, passwords)
│   ├── pvc.yaml                        # PersistentVolumeClaims for DB and models
│   ├── api-deployment.yaml             # FastAPI deployment (liveness/readiness, non-root)
│   ├── dashboard-deployment.yaml       # Next.js deployment (liveness/readiness)
│   ├── services.yaml                   # ClusterIP internal services
│   ├── ingress.yaml                    # Ingress controller with TLS & WebSocket support
│   └── hpa.yaml                        # Horizontal Pod Autoscalers (HPA)
├── monitoring/                         # Observability Configuration
│   ├── prometheus.yml                  # Prometheus metric scraping rules
│   └── grafana/dashboards/             # Pre-configured Grafana telemetry dashboards
├── ci-cd/                              # Automated CI/CD Pipelines
│   ├── release-pipeline.yml            # GitHub Actions production release & rollout workflow
│   └── gitlab-ci.yml                   # GitLab CI/CD alternative template
├── scripts/                            # Operational Automation Scripts
│   ├── deploy.sh                       # One-command automated production deployment
│   ├── rollback.sh                     # Emergency rollback to stable containers
│   ├── backup.sh                       # Daily database & model bundle snapshotting
│   ├── healthcheck.sh                  # Comprehensive health verification test
│   └── init-ssl.sh                     # SSL certificate generator (Let's Encrypt / self-signed)
└── docs/                               # Detailed Production Documentation
    ├── PRODUCTION_RUNBOOK.md           # Operational runbook: incidents, alerts, retraining
    ├── SECURITY_HARDENING.md           # Security audit, compliance, non-root user guide
    ├── DISASTER_RECOVERY.md            # RPO/RTO targets, backup restore, cold rebuilds
    └── ARCHITECTURE_PRODUCTION.md      # High-availability topology & data flow specs
```

---

## 🚀 Fast Track: Docker Compose Deployment

### 1. Prerequisites
- Docker Engine $\ge 24.0$
- Docker Compose v2 $\ge 2.20$
- Active trained models in `models/v1/` (`make train` or download)

### 2. Configure Environment
```bash
cp deployment/env.production.example deployment/.env.production
# Edit deployment/.env.production with your domain, secrets, and parameters
```

### 3. One-Click Automated Deployment
```bash
bash deployment/scripts/deploy.sh
```
This script will:
1. Validate required dependencies and environment files.
2. Build multi-stage optimized production containers.
3. Start the services (`netwatch-api`, `netwatch-dashboard`, `netwatch-nginx`) with health checks.
4. Verify HTTP, WebSocket, and ML inference endpoints before declaring success.
5. Automatically roll back if health checks fail.

### 4. Optional: Start Monitoring Stack (Prometheus + Grafana)
```bash
docker compose -f deployment/docker/docker-compose.monitoring.yml up -d
# Access Grafana at: http://localhost:3001 (default user: admin)
```

---

## ☸️ Enterprise Track: Kubernetes Deployment

### 1. Create Namespace & Secrets
```bash
kubectl apply -f deployment/k8s/namespace.yaml
kubectl apply -f deployment/k8s/configmap.yaml
# Copy secrets.template.yaml, replace base64 values, then apply:
kubectl apply -f deployment/k8s/secrets.yaml
```

### 2. Provision Storage & Workloads
```bash
kubectl apply -f deployment/k8s/pvc.yaml
kubectl apply -f deployment/k8s/api-deployment.yaml
kubectl apply -f deployment/k8s/dashboard-deployment.yaml
kubectl apply -f deployment/k8s/services.yaml
kubectl apply -f deployment/k8s/ingress.yaml
kubectl apply -f deployment/k8s/hpa.yaml
```

### 3. Verify Rollout Status
```bash
kubectl rollout status deployment/netwatch-api -n netwatch
kubectl rollout status deployment/netwatch-dashboard -n netwatch
kubectl get all,ingress -n netwatch
```

---

## 🔧 Operational Scripts Reference

| Script | Purpose | Usage |
|:---|:---|:---|
| [`deploy.sh`](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/scripts/deploy.sh) | Zero-downtime build, deployment & health validation | `bash deployment/scripts/deploy.sh` |
| [`healthcheck.sh`](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/scripts/healthcheck.sh) | Verifies API, scoring engine, alerts, and dashboard | `bash deployment/scripts/healthcheck.sh` |
| [`backup.sh`](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/scripts/backup.sh) | Archives DB, model bundles & reports with 30-day retention | `bash deployment/scripts/backup.sh` |
| [`rollback.sh`](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/scripts/rollback.sh) | Immediate rollback to cached stable containers | `bash deployment/scripts/rollback.sh` |
| [`init-ssl.sh`](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/scripts/init-ssl.sh) | Generates Let's Encrypt or self-signed SSL certs | `bash deployment/scripts/init-ssl.sh <domain>` |

---

## 📚 Detailed Reference Documentation

- 📖 [**Production Runbook**](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/docs/PRODUCTION_RUNBOOK.md) — Incident response procedures, false alert spikes, and retraining workflow.
- 🔒 [**Security Hardening Guide**](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/docs/SECURITY_HARDENING.md) — Non-root users, rate limiting, and security headers.
- 🔄 [**Disaster Recovery Plan**](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/docs/DISASTER_RECOVERY.md) — RTO/RPO objectives, database recovery, and cold rebuilds.
- 🏗️ [**Production Architecture**](file:///Users/satveekgupta/Developer/MS%20Hack/Net-Watch/deployment/docs/ARCHITECTURE_PRODUCTION.md) — Network topology, data flow, and concurrency specifications.
