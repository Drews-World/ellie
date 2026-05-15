from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
import httpx
from .config import get_settings

security = HTTPBearer()

# Simple in-process JWKS cache — refreshed on startup and on decode failure
_jwks_cache: dict | None = None


async def _fetch_jwks(jwks_url: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=5.0)
        resp.raise_for_status()
        return resp.json()


async def get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache
    settings = get_settings()
    if _jwks_cache is None or force_refresh:
        _jwks_cache = await _fetch_jwks(settings.clerk_jwks_url)
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify Clerk JWT via JWKS and return {id, email}."""
    settings = get_settings()
    token = credentials.credentials

    if not settings.clerk_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_JWKS_URL not configured",
        )

    async def _decode(jwks: dict) -> dict:
        return jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

    try:
        jwks = await get_jwks()
        try:
            payload = await _decode(jwks)
        except JWTError:
            # Keys may have rotated — retry with a fresh fetch
            jwks = await get_jwks(force_refresh=True)
            payload = await _decode(jwks)

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
            )

        return {
            "id": user_id,
            "email": payload.get("email", ""),
        }

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
