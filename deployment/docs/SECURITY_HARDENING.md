# ==============================================================================
# NetWatch AI SOC — Security Hardening Guide
# ==============================================================================

This document details security configurations, compliance measures, and threat mitigations implemented across NetWatch production infrastructure.

---

## 1. Container Security & Isolation

### Non-Root Execution Context
Both the API and Dashboard containers run strictly as non-privileged system users:
- **API Container**: Runs as `netwatch:netwatch` (`UID 10001`, `GID 10001`).
- **Dashboard Container**: Runs as `nextjs:nodejs` (`UID 1001`, `GID 1001`).

```dockerfile
# Dropping privileges in Dockerfile
RUN groupadd -g 10001 netwatch && \
    useradd -u 10001 -g netwatch -s /bin/bash -m netwatch
USER netwatch
```

### Linux Capabilities & Privilege Escalation
In Kubernetes deployments (`deployment/k8s/api-deployment.yaml`), privilege escalation is disabled and all unnecessary Linux capabilities are dropped:
```yaml
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

---

## 2. Network Security & Reverse Proxy

### Perimeter Protection (Nginx)
The reverse proxy (`deployment/nginx/nginx.conf`) acts as the single public entry point:
- **Direct Backend Exposure Blocked**: Port 8000 (FastAPI) and port 3000 (Next.js) are not exposed to the public internet; they exist only inside the internal Docker bridge network (`netwatch-prod-network`).
- **DDoS Mitigation & Rate Limiting**:
  - `/api/score`: limited to 100 requests/sec per client IP, burst 30.
  - The rest of the API (`/api/...`): limited to 50 requests/sec per client IP, burst 20.
  - The replayer and anything else on the private network call the API directly, without these limits.
  - Client max body size capped at 25MB.

### TLS / HTTPS Enforcement (with `NGINX_SITE=https`)
These hold when `.env.production` sets `NGINX_SITE=https`, which serves `nginx/site-https.conf` and needs the certificates `scripts/init-ssl.sh` writes. The default, `NGINX_SITE=http`, is plain HTTP for local and staging use.
- All HTTP traffic redirects to HTTPS (port 443).
- **HSTS** (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) for 1 year, sent over HTTPS only.
- TLS 1.2 and TLS 1.3 only; SSLv3 and TLS 1.0/1.1 are not offered.

### CORS
`ALLOWED_ORIGINS` (comma-separated) limits which other origins may call the API. Behind nginx the dashboard is on the same origin, so it can stay empty: any origin may read the API, and never with credentials.

---

## 3. Web Security Headers

Configured in `deployment/nginx/security-headers.conf`:

| Header | Production Setting | Mitigates |
|:---|:---|:---|
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | MIME confusion / sniffing attacks |
| `X-XSS-Protection` | `1; mode=block` | Cross-Site Scripting (XSS) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage to external origins |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Unauthorized sensor/device access |
| `Content-Security-Policy` | Whitelisted origins for Spline 3D WebGL assets | Arbitrary inline script injection |

---

## 4. Secrets Management

- **Zero Plaintext Secrets in Repos**:
  - Never commit `.env.production` or actual Kubernetes Secret manifests.
  - Use `deployment/env.production.example` and `deployment/k8s/secrets.template.yaml` as baseline templates.
- **Production Secret Stores**:
  - In cloud deployments (AWS, GCP, Azure), integrate with AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault via Kubernetes External Secrets Operator (ESO).
- **Secret Rotation**:
  - Rotate the Grafana admin password, and renew TLS certificates (Let's Encrypt: every 90 days, `init-ssl.sh`).
  - The API has no login, signing key or database password today: anyone who can reach it can read and triage alerts. Keep it on a private network or behind an authenticating proxy.

---

## 5. Security Scanning & Dependency Audits

```bash
# Scan Python dependencies for known CVEs
pip install safety
safety check -r requirements.txt

# Scan Docker image vulnerabilities with Trivy
trivy image netwatch-api:production
trivy image netwatch-dashboard:production

# Static Application Security Testing (SAST) with Bandit
pip install bandit
bandit -r api/ ml/
```
