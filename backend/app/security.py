"""Password hashing (Argon2) and opaque session tokens. Never log passwords or tokens."""

import hashlib
import secrets

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()  # Argon2id
# Used to equalize timing when the email does not exist (no account enumeration).
_DUMMY_HASH = _hasher.hash("not-a-real-password-0")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    try:
        return _hasher.verify(password, password_hash)
    except Exception:
        return False


def burn_password_check(password: str) -> None:
    _hasher.verify(password, _DUMMY_HASH)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str, secret: str) -> str:
    return hashlib.sha256((secret + token).encode("utf-8")).hexdigest()
