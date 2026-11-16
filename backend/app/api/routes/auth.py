import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import User
from app.schemas import TokenOut, UserLogin, UserOut, UserRegister
from app.utils.errors import AppError
from app.utils.responses import ok

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("agrovision.auth")


@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError(409, "An account with this email already exists", "email_exists")
    if payload.role == "admin":
        # Public registration can never create admins (see create_admin.py).
        raise AppError(403, "Admin accounts cannot be created through public registration", "admin_registration_forbidden")
    user = User(full_name=payload.full_name, email=email, mobile=payload.mobile,
                password_hash=hash_password(payload.password), role="farmer",
                preferred_language=payload.preferred_language)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New farmer registered: user_id=%s", user.id)
    token = create_access_token(user.id, user.role)
    return ok(TokenOut(access_token=token, user=UserOut.model_validate(user)).model_dump(mode="json"), "Registration successful")


@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        logger.info("Failed login attempt")
        raise AppError(401, "Invalid email or password", "invalid_credentials")
    if not user.is_active:
        raise AppError(403, "This account has been deactivated", "account_inactive")
    token = create_access_token(user.id, user.role)
    return ok(TokenOut(access_token=token, user=UserOut.model_validate(user)).model_dump(mode="json"), "Login successful")


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(user).model_dump(mode="json"))
