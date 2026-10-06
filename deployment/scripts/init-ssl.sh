#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — SSL Certificate Provisioning Script
# ==============================================================================
# Writes deployment/nginx/ssl/fullchain.pem and privkey.pem, which
# docker-compose.prod.yml mounts into nginx at /etc/nginx/ssl. Then set
# NGINX_SITE=https in .env.production and restart nginx.
#
# Usage: init-ssl.sh DOMAIN [selfsigned|letsencrypt] [EMAIL]
#
# Let's Encrypt runs certbot standalone, which needs port 80: stop nginx first
# (docker compose ... stop nginx). Certificates last 90 days; run it again to renew.
# ==============================================================================

set -euo pipefail

DOMAIN="${1:-netwatch.local}"
SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/ssl"

mkdir -p "${SSL_DIR}"

if [ "${2:-selfsigned}" = "letsencrypt" ]; then
    echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
    docker run --rm \
        -v "${SSL_DIR}/letsencrypt:/etc/letsencrypt" \
        -p 80:80 \
        certbot/certbot certonly --standalone \
        -d "${DOMAIN}" --non-interactive --agree-tos -m "${3:-admin@${DOMAIN}}"
    # certbot writes live/<domain>/*.pem as links into archive/; nginx reads
    # plain files at the top of the ssl directory
    cp -L "${SSL_DIR}/letsencrypt/live/${DOMAIN}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
    cp -L "${SSL_DIR}/letsencrypt/live/${DOMAIN}/privkey.pem" "${SSL_DIR}/privkey.pem"
else
    echo "Generating 2048-bit self-signed SSL certificate for ${DOMAIN}..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_DIR}/privkey.pem" \
        -out "${SSL_DIR}/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=NetWatch/CN=${DOMAIN}"
fi
echo "Certificate at ${SSL_DIR}/fullchain.pem. Set NGINX_SITE=https and restart nginx."
