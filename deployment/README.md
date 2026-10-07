# ==============================================================================
# NetWatch AI SOC — Production Deployment Handbook
# ==============================================================================

This directory contains the container specifications, reverse proxy rules, a release pipeline template and the operational scripts for running **NetWatch AI SOC** with Docker Compose (the stack is the root `docker-compose.yml`).

**What is verified:** the single-host Docker Compose stack (nginx, API, dashboard, demo replayer), the scripts, and nginx's HTTP and HTTPS sites. **Not yet:** the release pipeline template (see its section).

---

## 📁 Deployment Directory Structure

```text
deployment/
├── README.md                           # Master Production & Deployment Guide (this file)
├── env.production.example              # Every variable the stack reads, documented
├── docker/                             # Hardened Production Container Configurations
│   ├── Dockerfile.api                  # Multi-stage FastAPI backend (non-root, one worker, healthcheck)
│   ├── Dockerfile.dashboard            # Multi-stage Next.js frontend (non-root, healthcheck)
│   └── Dockerfile.replayer             # Demo traffic replayer (one scenario per run)
├── nginx/                              # Reverse Proxy, TLS, & Rate Limiting
│   ├── nginx.conf                      # Common settings, upstreams, rate-limit zones
│   ├── netwatch-locations.conf         # Routes: API under /api, dashboard everywhere else
│   ├── site-http.conf                  # Plain HTTP site (NGINX_SITE=http, the default)
│   ├── site-https.conf                 # HTTP→HTTPS redirect, TLS 1.2+, HSTS (NGINX_SITE=https)
│   ├── security-headers.conf           # Security headers (CSP, X-Frame-Options, ...)
│   └── ssl/                            # Certificates from init-ssl.sh (gitignored)
├── ci-cd/                              # Release pipeline template: not active (see below)
│   └── release-pipeline.yml            # GitHub Actions: audit, then publish images to GHCR
└── scripts/                            # Operational Automation Scripts
    ├── deploy.sh                       # Build, start, health-check; roll back on failure
    ├── rollback.sh                     # Put back the images from before the last deploy
    ├── backup.sh                       # Snapshot the alert store, models & reports
    ├── healthcheck.sh                  # End-to-end check through nginx
    └── init-ssl.sh                     # TLS certificates (Let's Encrypt / self-signed)
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
docker compose -f docker-compose.yml --env-file deployment/.env.production \
  --profile demo run --rm -e REPLAY_SCENARIO=known replayer
```
It reads `data/` from the repository (processed flows and the splits `make train` writes).

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

## 🧩 Release pipeline — not active

`ci-cd/release-pipeline.yml` is a GitHub Actions workflow: on a version tag it runs the backend tests and the dashboard type-check and build, then publishes the API and dashboard images to GHCR. GitHub only runs workflows in `.github/workflows/`, so it does not run; the repository's CI is `.github/workflows/ci.yml`. Activating it is a team decision (it pushes images to a registry).
