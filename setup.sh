#!/usr/bin/env bash
# =============================================================================
# setup.sh  –  Bootstrap the NetWatch Python virtual environment (Linux/macOS)
# Usage:  bash setup.sh
# =============================================================================
set -euo pipefail

VENV_DIR=".venv"
PYTHON="${PYTHON:-python3}"

echo "==> Checking Python version …"
$PYTHON --version

echo "==> Creating virtual environment in $VENV_DIR …"
$PYTHON -m venv "$VENV_DIR"

echo "==> Upgrading pip / setuptools / wheel …"
"$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel

echo "==> Installing project requirements …"
"$VENV_DIR/bin/pip" install -r requirements.txt

echo ""
echo "✅  Environment ready."
echo "   Activate with:  source $VENV_DIR/bin/activate"
echo "   Or just use:    make train  (it uses the venv automatically)"
