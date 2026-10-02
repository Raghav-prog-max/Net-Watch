#!/usr/bin/env bash
# ==============================================================================
# NetWatch AI SOC — SSL Certificate Provisioning Script
# ==============================================================================
# Generates self-signed certificates for staging/testing or sets up Let's Encrypt.
# ==============================================================================

set -euo pipefail

DOMAIN="${1:-netwatch.local}"
SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/ssl"

mkdir -p "${SSL_DIR}"

if [ "${2:-selfsigned}" = "letsencrypt" ]; then
    echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
    docker run --rm -it \
        -v "${SSL_DIR}:/etc/letsencrypt" \
        -p 80:80 \
        certbot/certbot certonly --standalone \
        -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}"
else
    echo "Generating 2048-bit self-signed SSL certificate for ${DOMAIN}..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_DIR}/privkey.pem" \
        -out "${SSL_DIR}/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=NetWatch/CN=${DOMAIN}"
    echo "Self-signed certificate generated at ${SSL_DIR}"
fi
