"""Shared FastAPI dependencies: DB session, current user, role checks."""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.session import get_db
from app.models import User
from app.utils.errors import AppError

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise AppError(401, "Not authenticated", "unauthorized")
    payload = decode_access_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise AppError(401, "Invalid or expired token", "invalid_token")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise AppError(401, "Invalid token subject", "invalid_token")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "User not found or inactive", "invalid_token")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise AppError(403, "Admin access required", "forbidden")
    return user
