#!/usr/bin/env bash
# =============================================================================
# run.sh  –  Run any NetWatch command inside the .venv (Linux/macOS)
# Usage:
#   ./run.sh python ml/train.py
#   ./run.sh pytest tests/
#   ./run.sh make train
# =============================================================================
set -euo pipefail

VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "❌  Virtual environment not found. Run: bash setup.sh"
    exit 1
fi

exec "$VENV_DIR/bin/python" "$@"
