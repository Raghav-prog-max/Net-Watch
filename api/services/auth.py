"""Shared API key for the endpoints that write: POST /score (new alerts) and
PATCH /alerts/{id} (analyst labels, which scripts/retrain.py turns into
training rows). Without it, anyone who can reach the API could mark their own
attack a false positive and have it trained in as benign.

NETWATCH_API_KEY set: those endpoints need it in the X-API-Key header, 401
otherwise. Unset: they stay open, as the local demo needs; the API logs a
warning at startup. Read on each request, so tests can set it per case."""
import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException

API_KEY_ENV = "NETWATCH_API_KEY"
API_KEY_HEADER = "X-API-Key"


def configured_key() -> Optional[str]:
    return os.environ.get(API_KEY_ENV) or None


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    key = configured_key()
    if key is None:
        return
    # constant-time compare, so the key can't be guessed a character at a time
    if x_api_key is None or not hmac.compare_digest(x_api_key.encode(), key.encode()):
        raise HTTPException(status_code=401, detail=f"missing or wrong {API_KEY_HEADER} header",
                            headers={"WWW-Authenticate": API_KEY_HEADER})
