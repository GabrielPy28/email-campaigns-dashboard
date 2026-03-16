"""
Creación y validación de JWT tras verificar usuario en auth.users (bcrypt).
"""
from datetime import datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt
from app.core.config import get_settings


def create_access_token(sub: UUID | str, email: str, name: str = "") -> str:
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(sub),
        "email": email,
        "name": name,
        "exp": expire,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None
