import os
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    # In sandbox/demo mode, we might allow a default or empty key, but for
    # loophole 4, we must enforce a key check.
    expected = os.environ.get("NETWATCH_API_KEY", "netwatch-demo-key")
    if api_key != expected:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key
