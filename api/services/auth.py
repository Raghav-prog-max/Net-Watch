"""Shared API key for the endpoints that write: POST /score (new alerts) and
PATCH /alerts/{id} (analyst labels, which scripts/retrain.py turns into
training rows). Without it, anyone who can reach the API could mark their own
attack a false positive and have it trained in as benign.

NETWATCH_API_KEY set: those endpoints need it in the X-API-Key header, 401
otherwise. Unset: they stay open, as the local demo needs; the API logs a
warning at startup. There is no default key: one written here would be public
in the repository. Read on each request, so tests can set it per case.

The header is read through FastAPI's APIKeyHeader scheme, so /docs lists the
key and offers an Authorize button."""
import hmac
import os
from typing import Optional

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

API_KEY_ENV = "NETWATCH_API_KEY"
API_KEY_HEADER = "X-API-Key"

# auto_error=False: a missing header is this module's decision (open when no key
# is configured), not FastAPI's automatic 403
_api_key_header = APIKeyHeader(name=API_KEY_HEADER, auto_error=False,
                               description=f"The API's {API_KEY_ENV}, when it sets one")


def configured_key() -> Optional[str]:
    return os.environ.get(API_KEY_ENV) or None


def require_api_key(x_api_key: Optional[str] = Security(_api_key_header)) -> None:
    key = configured_key()
    if key is None:
        return
    # constant-time compare, so the key can't be guessed a character at a time
    if x_api_key is None or not hmac.compare_digest(x_api_key.encode(), key.encode()):
        raise HTTPException(status_code=401, detail=f"missing or wrong {API_KEY_HEADER} header",
                            headers={"WWW-Authenticate": API_KEY_HEADER})
