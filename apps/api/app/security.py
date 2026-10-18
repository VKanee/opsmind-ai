from datetime import UTC, datetime, timedelta
from typing import cast

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.config import Settings
from app.models import User

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(user: User, settings: Settings) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.access_token_minutes)
    now = datetime.now(UTC)
    payload = {
        "sub": user.id,
        "org": user.organization_id,
        "role": user.role.value,
        "iat": now,
        "exp": now + expires_delta,
        "iss": "opsmind-ai",
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return cast(str, token), int(expires_delta.total_seconds())


def decode_access_token(token: str, settings: Settings) -> dict[str, object]:
    decoded = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        issuer="opsmind-ai",
    )
    return dict(decoded)
